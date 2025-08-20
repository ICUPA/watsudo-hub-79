// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno&dts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_WA_E164 = Deno.env.get("BOT_WA_E164") ?? "";
const sb = createClient(SUPABASE_URL, SRK);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "create_basket") {
      const user = await getUserByWa(body.wa_id);
      const type = await sb.from("basket_types").select("id,label").eq("key", body.type_key).maybeSingle();
      const period = body.period_key ? await sb.from("period_options").select("id,label").eq("key", body.period_key).maybeSingle() : { data: null };
      const token = makeToken();
      const collector = String(body.collector_choice || "mine") === "mine"
        ? (user?.momo_phone || null)
        : (String(body.collector_momo || "") || null);

      const { data: basket } = await sb.from("baskets").insert({
        creator_id: user!.id,
        name: body.name,
        type_id: type.data?.id,
        period_id: period.data?.id ?? null,
        collector_momo: collector,
        status: "private",
        token
      }).select().single();

      const deep_link = basketDeepLink(token);
      return json({ ok: true, name: basket.name, token, deep_link });
    }

    if (action === "request_public") {
      const user = await getUserByWa(body.wa_id);
      const b = await sb.from("baskets").select("id,creator_id").eq("id", body.basket_id).single();
      if (b.data?.creator_id !== user?.id) return json({ ok: false, error: "not_owner" }, 403);
      const { data: vr } = await sb.from("visibility_requests").insert({ basket_id: b.data.id, status: "pending" }).select().single();
      await sb.from("admin_queue").insert({ kind: "visibility_request", ref_id: vr.id, basket_id: b.data.id, status: "pending" });
      return json({ ok: true });
    }

    if (action === "invite_link") {
      const user = await getUserByWa(body.wa_id);
      const b = await sb.from("baskets").select("id,token,collector_momo,name,creator_id").eq("id", body.basket_id).single();
      if (b.data?.creator_id !== user?.id) return json({ ok: false, error: "not_owner" }, 403);
      const deep_link = basketDeepLink(b.data.token);
      const ussd = makeUSSD(b.data.collector_momo || "");
      return json({ ok: true, deep_link, ussd, name: b.data.name });
    }

    if (action === "basket_landing") {
      const token = String(body.token || "");
      const b = await sb
        .from("baskets")
        .select("id,name,collector_momo,status,creator_id,type_id,period_id,creator:creator_id(users(wa_id))")
        .eq("token", token).maybeSingle();

      const type = b.data?.type_id ? await sb.from("basket_types").select("label").eq("id", b.data.type_id).maybeSingle() : { data: null };
      const period = b.data?.period_id ? await sb.from("period_options").select("label").eq("id", b.data.period_id).maybeSingle() : { data: null };
      const wa = b.data?.creator?.users?.wa_id ? `+${b.data.creator.users.wa_id}` : "";
      const ussd = makeUSSD(b.data?.collector_momo || "");
      const warning = (await sb.from("message_templates").select("text").eq("key","basket_warning").maybeSingle()).data?.text;

      return json({ ok: true, name: b.data?.name, type_label: type.data?.label, period_label: period.data?.label, creator_phone: wa, ussd, warning });
    }

    if (action === "declare_contribution") {
      const user = await getOrCreateUserByWa(body.wa_id);
      const token = String(body.token || "");
      const { data: b } = await sb.from("baskets").select("id,creator_id").eq("token", token).single();

      const { data: contrib } = await sb.from("contributions").insert({
        basket_id: b.id, contributor_user_id: user.id, amount: Number(body.amount || 0), note: String(body.note||""), status: "pending"
      }).select().single();

      await sb.from("admin_queue").insert({ kind:"contribution_pending", ref_id: contrib.id, basket_id: b.id, user_id: user.id, status: "pending" });
      return json({ ok: true, contribution_id: contrib.id });
    }

    if (action === "view_members") {
      const token = String(body.token || "");
      const { data: b } = await sb.from("baskets").select("id").eq("token", token).single();
      const { data: totals } = await sb.from("basket_totals").select("*").eq("basket_id", b.id).single();
      const { data: rows } = await sb
        .from("contributions")
        .select("contributor_user_id, anon_code, amount, status, users!inner(anon_code)")
        .eq("basket_id", b.id).eq("status","approved");

      const agg: Record<string, number> = {};
      (rows||[]).forEach((r:any) => {
        const code = r.users?.anon_code || r.anon_code || "Anon";
        agg[code] = (agg[code]||0) + Number(r.amount || 0);
      });
      const members = Object.entries(agg).map(([anon,total]) => ({ anon_code: anon, total }));
      return json({ ok:true, total: totals?.total_approved || 0, count: totals?.contributions_count||0, members });
    }

    if (action === "toggle_reminder") {
      const user = await getUserByWa(body.wa_id);
      const bid = String(body.basket_id||"");
      const { data: row } = await sb.from("reminder_subscriptions")
        .upsert({ basket_id: bid, user_id: user!.id, enabled: !!body.enabled, frequency: String(body.frequency||"monthly") }, { onConflict: "basket_id,user_id" })
        .select().single();
      return json({ ok:true, row });
    }

    if (action === "save_profile") {
      const u = await getOrCreateUserByWa(body.wa_id);
      await sb.from("users").update({
        momo_phone: body.momo ? normalizeRwandaPhone(String(body.momo)) : u.momo_phone,
        language: String(body.language||"en"),
        notify: !!body.notify
      }).eq("id", u.id);
      return json({ ok:true });
    }

    return json({ ok:false, error:"unknown_action" }, 400);
  } catch (e) {
    return json({ ok:false, error:String(e) }, 500);
  }
});

/* ===== helpers ===== */
function json(d:any, status=200){ 
  return new Response(JSON.stringify(d), {
    status, 
    headers: {...corsHeaders, "Content-Type":"application/json"}
  }); 
}

function makeToken(){ return crypto.randomUUID().slice(0,8).replace(/-/g,""); }

function basketDeepLink(token:string){
  // WhatsApp deep link: /basket <token>
  return `https://wa.me/${BOT_WA_E164}?text=${encodeURIComponent("/basket "+token)}`;
}

function makeUSSD(collector:string){
  const id = normalizeRwandaPhone(collector||"") || collector;
  return `tel:*182*1*1*${id}#`;
}

async function getUserByWa(wa_id:string){ 
  if(!wa_id) return null; 
  const {data}=await sb.from("users").select("*").eq("wa_id", wa_id).maybeSingle(); 
  return data; 
}

async function getOrCreateUserByWa(wa_id:string){
  let u = await getUserByWa(wa_id); 
  if (u) return u;
  const anon = Math.floor(100000+Math.random()*900000).toString();
  const { data } = await sb.from("users").insert({ wa_id, anon_code: anon }).select().single();
  return data!;
}

function normalizeRwandaPhone(input:string){
  const digits = input.replace(/[^\d]/g,"");
  if (/^07\d{8}$/.test(digits)) return digits;
  if (/^2507\d{8}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^7\d{8}$/.test(digits)) return `0${digits}`;
  if (/^\+?2507\d{8}$/.test(input)) return `0${input.replace(/[^\d]/g, "").slice(-9)}`;
  return digits;
}