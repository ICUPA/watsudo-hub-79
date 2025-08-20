// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno&dts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_TOKEN = Deno.env.get("META_ACCESS_TOKEN") ?? "";
const META_PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID") ?? "";
const GRAPH = "https://graph.facebook.com/v20.0";
const sb = createClient(SUPABASE_URL, SRK);

Deno.serve(async (req)=> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try{
    const body = await req.json();
    const action = String(body.action||"");

    if (action==="notify_contribution_pending") {
      const id = String(body.contribution_id);
      const { data: c } = await sb.from("contributions")
        .select("id,basket_id,amount,created_at,baskets!inner(creator_id,name),users!contributor_user_id(anon_code,wa_id)")
        .eq("id", id).single();
      const { data: creator } = await sb.from("users").select("wa_id").eq("id", c.baskets.creator_id).single();
      const to = creator.wa_id;
      const msg = `Contribution pending for "${c.baskets.name}"\nFrom: Member ${c.users.anon_code}\nAmount: RWF ${Number(c.amount).toLocaleString("en-US")}\nApprove or Reject.`;
      await sendButtons(to, msg, [
        { id: `CONTRIB_APPROVE_${c.id}`, title: "Approve" },
        { id: `CONTRIB_REJECT_${c.id}`, title: "Reject" }
      ]);
      await sb.from("admin_queue").insert({ kind:"contribution_pending", ref_id: c.id, basket_id: c.basket_id, status:"pending" });
      return json({ok:true});
    }

    if (action==="moderate") {
      const decision = String(body.decision||"");
      const queue_id = String(body.queue_id||"");
      const note = String(body.note||"");

      const { data: q } = await sb.from("admin_queue").select("*").eq("id", queue_id).single();
      if (!q) return json({ok:false, error:"queue_not_found"},404);

      if (q.kind === "visibility_request") {
        // resolve a visibility request
        const { data: vr } = await sb.from("visibility_requests").select("*").eq("id", q.ref_id).single();
        const newStatus = decision === "approve" ? "approved" : "rejected";
        await sb.from("visibility_requests").update({ status: newStatus, decided_at: new Date().toISOString() }).eq("id", vr.id);
        if (newStatus === "approved") await sb.from("baskets").update({ status: "public" }).eq("id", vr.basket_id);
        await sb.from("admin_queue").update({ status: newStatus }).eq("id", queue_id);
        return json({ok:true});
      }

      if (q.kind === "contribution_pending") {
        const newStatus = decision === "approve" ? "approved" : "rejected";
        await sb.from("contributions").update({ status: newStatus, decided_at: new Date().toISOString() }).eq("id", q.ref_id);
        await sb.from("admin_queue").update({ status: newStatus }).eq("id", queue_id);

        // Notify contributor
        const { data: c } = await sb.from("contributions").select("amount,basket_id,contributor_user_id,users!contributor_user_id(wa_id),baskets(name)").eq("id", q.ref_id).single();
        const to = c.users.wa_id;
        const text = newStatus==="approved" ? `Thank you! Your contribution to "${c.baskets.name}" has been recorded.` : `Sorry, your contribution to "${c.baskets.name}" was not approved.`;
        await sendText(to, text);
        return json({ok:true});
      }

      return json({ok:false, error:"unsupported_kind"});
    }

    if (action==="create_ticket") {
      await sb.from("admin_queue").insert({ kind:"support_ticket", payload: body, status:"pending" });
      return json({ok:true});
    }

    if (action==="insurance_claim_intake") {
      const u = await getOrCreateUserByWa(body.wa_id);
      await sb.from("insurance_claims").insert({
        user_id: u.id,
        plate: body?.data?.plate || null,
        incident_date: body?.data?.incident_date || null,
        description: body?.data?.description || null,
        docs: body?.data?.docs || null,
        status: "pending"
      });
      await sb.from("admin_queue").insert({ kind:"claim", user_id: u.id, payload: body?.data||{}, status:"pending" });
      return json({ok:true});
    }

    if (action==="driver_onboard") {
      const u = await getOrCreateUserByWa(body.wa_id);
      await sb.from("drivers").insert({
        user_id: u.id, status:"pending",
        vehicle_type: body?.data?.vehicle_type || null,
        route_from: body?.data?.route_from || null,
        route_to: body?.data?.route_to || null,
        available_date: body?.data?.date || null,
        available_time: body?.data?.time || null,
        notes: body?.data?.notes || null
      });
      await sb.from("admin_queue").insert({ kind:"driver_onboard", user_id: u.id, payload: body?.data||{}, status:"pending" });
      return json({ok:true});
    }

    if (action==="report_trip") {
      const u = await getOrCreateUserByWa(body.wa_id);
      await sb.from("admin_queue").insert({ kind:"report", user_id: u.id, payload: body?.data||{}, status:"pending" });
      return json({ok:true});
    }

    // Legacy QR actions for compatibility
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

    return json({ok:false, error:"unknown_action"}, 400);
  } catch(e) {
    return json({ok:false, error:String(e)}, 500);
  }
});

function json(d:any, status=200){ 
  return new Response(JSON.stringify(d), {
    status, 
    headers: {...corsHeaders, "Content-Type":"application/json"}
  }); 
}

async function sendText(toDigits:string, body:string){
  await fetch(`${GRAPH}/${META_PHONE_ID}/messages`,{
    method:"POST",
    headers:{ "Authorization":`Bearer ${META_TOKEN}`, "Content-Type":"application/json" },
    body: JSON.stringify({ messaging_product:"whatsapp", to: toDigits, type:"text", text:{ body } })
  });
}

async function sendButtons(toDigits:string, body:string, buttons:{id:string,title:string}[]){
  const payload = {
    messaging_product:"whatsapp",
    to: toDigits,
    type:"interactive",
    interactive:{
      type:"button",
      body:{ text: body },
      action:{ buttons: buttons.slice(0,3).map(b=>({ type:"reply", reply:{ id:b.id, title:b.title }})) }
    }
  };
  await fetch(`${GRAPH}/${META_PHONE_ID}/messages`,{
    method:"POST",
    headers:{ "Authorization":`Bearer ${META_TOKEN}`, "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
}

async function getOrCreateUserByWa(wa_id:string){
  const { data } = await sb.from("users").select("*").eq("wa_id", wa_id).maybeSingle();
  if (data) return data;
  const anon = Math.floor(100000+Math.random()*900000).toString();
  const ins = await sb.from("users").insert({ wa_id, anon_code: anon }).select().single();
  return ins.data!;
}