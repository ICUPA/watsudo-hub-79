// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import * as base64 from "https://deno.land/std@0.223.0/encoding/base64.ts";
// Remove QR import - use web service instead

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const WABA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const WABA_VERIFY = Deno.env.get("WHATSAPP_VERIFY_TOKEN")!;
const WABA_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const WABA_APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET")!;
const GRAPH = "https://graph.facebook.com/v20.0";
const sb = createClient(SB_URL, SB_SERVICE);

// UI helpers
const btns = (to:string, body:string, items:{id:string;title:string}[]) =>
  fetch(`${GRAPH}/${WABA_PHONE_ID}/messages`, {
    method:"POST", headers:{Authorization:`Bearer ${WABA_TOKEN}`,"Content-Type":"application/json"},
    body: JSON.stringify({ messaging_product:"whatsapp", to, type:"interactive",
      interactive:{ type:"button", body:{text:body}, action:{ buttons:items.map(b=>({type:"reply",reply:b})) } }})
  });
const list = (to:string, body:string, rows:{id:string;title:string;description?:string}[], title="Select", sectionTitle="Options") =>
  fetch(`${GRAPH}/${WABA_PHONE_ID}/messages`, {
    method:"POST", headers:{Authorization:`Bearer ${WABA_TOKEN}`,"Content-Type":"application/json"},
    body: JSON.stringify({ messaging_product:"whatsapp", to, type:"interactive",
      interactive:{ type:"list", header:{type:"text",text:title}, body:{text:body}, action:{button:"Choose",sections:[{title:sectionTitle,rows}]}}})
  });
const text = (to:string, body:string) =>
  fetch(`${GRAPH}/${WABA_PHONE_ID}/messages`, {
    method:"POST", headers:{Authorization:`Bearer ${WABA_TOKEN}`,"Content-Type":"application/json"},
    body: JSON.stringify({ messaging_product:"whatsapp", to, type:"text", text:{body} })
  });
const image = (to:string, link:string, caption?:string) =>
  fetch(`${GRAPH}/${WABA_PHONE_ID}/messages`, {
    method:"POST", headers:{Authorization:`Bearer ${WABA_TOKEN}`,"Content-Type":"application/json"},
    body: JSON.stringify({ messaging_product:"whatsapp", to, type:"image", image:{link, caption} })
  });

// States / IDs  
const MAIN = ["MOBILITY","INSURANCE","QR","PROFILE","HOME"] as const;
const MOBILITY = ["ND","ST","AV","HOME"] as const;
const QR_IDS = ["QR_PHONE","QR_CODE","QR_AMT_WITH","QR_AMT_NONE","QR_A_1000","QR_A_2000","QR_A_5000","QR_A_OTHER","QR_AGAIN","QR_CHANGE_DEFAULT","HOME"] as const;

const INS_STATES = {
  MENU: "INS_MENU",
  CHECK: "INS_CHECK_VEHICLE", 
  COLLECT: "INS_COLLECT_DOCS",
  START: "INS_CHOOSE_START",
  PERIOD: "INS_CHOOSE_PERIOD",
  ADDONS: "INS_CHOOSE_ADDONS",
  PA: "INS_CHOOSE_PA",
  SUMMARY: "INS_SUMMARY",
  QUEUED: "INS_QUEUED",
  DECIDE: "INS_DECIDE",
  PLAN: "INS_PAYMENT_PLAN",
  AWAIT: "INS_AWAIT_PAYMENT",
  ISSUED: "INS_ISSUED",
} as const;

// Util
const ok = (b:unknown)=> new Response(JSON.stringify(b),{status:200,headers:{"content-type":"application/json"}});
const bad = (m:string,s=400)=> new Response(m,{status:s});
function getInteractiveId(m:any){
  if(m?.type!=="interactive") return undefined;
  const i=m.interactive; if(i?.type==="button_reply") return i.button_reply?.id; if(i?.type==="list_reply") return i.list_reply?.id;
}
function normalizePhone(p:string){
  const d=p.replace(/[^\d+]/g,"");
  if(d.startsWith("+")) return d;
  if(d.startsWith("07")) return `+250${d.slice(1)}`;
  if(d.startsWith("2507")) return `+${d}`;
  return d;
}
function buildTel(ussd:string){ return `tel:${encodeURIComponent(ussd).replace(/%2A/g,"*")}`; }
function buildUSSD(ctx:any){
  const t = ctx.qr?.type, phone = ctx.qr?.phone, code = ctx.qr?.code, amt = ctx.qr?.amount;
  if(t==="phone"){
    const local = phone.startsWith("+250")? `0${phone.slice(4)}` : phone.replace(/^\+/,'');
    return amt? `*182*1*1*${local}*${amt}#` : `*182*1*1*${local}#`;
  } else {
    return amt? `*182*8*1*${code}*${amt}#` : `*182*8*1*${code}#`;
  }
}

// WA media fetch
async function fetchMedia(mediaId:string){
  const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers:{Authorization:`Bearer ${WABA_TOKEN}`}});
  const meta = await metaRes.json();
  const fileRes = await fetch(meta.url, { headers:{Authorization:`Bearer ${WABA_TOKEN}`}});
  return { bytes: new Uint8Array(await fileRes.arrayBuffer()), mime: meta.mime_type ?? "application/octet-stream" };
}

// User/session
async function getOrCreateUser(wa_phone:string, wa_name?:string){
  let { data: profiles } = await sb.from("profiles").select("*").eq("wa_phone",wa_phone).limit(1);
  if(!profiles?.length){
    const { data } = await sb.from("profiles").insert({wa_phone,wa_name}).select("*").single();
    profiles = [data];
  }
  const user = profiles[0];
  let { data: sessions } = await sb.from("chat_sessions").select("*").eq("user_id",user.user_id || user.id).limit(1);
  if(!sessions?.length){
    const { data: s2 } = await sb.from("chat_sessions").insert({user_id: user.user_id || user.id}).select("*").single();
    sessions = [s2];
  }
  return { user, session: sessions[0] as any };
}
async function setState(sessionId:string, state:string, context:Record<string,unknown>={}) {
  await sb.from("chat_sessions").update({ state, context }).eq("id",sessionId);
}

// OCR (Insurance certificate)
async function ocrVehicleDoc(publicUrl:string){
  const prompt = `Extract JSON from the insurance certificate image/PDF with keys:
  plate, vin, make, model, model_year, insurance_provider, insurance_policy, insurance_expiry (YYYY-MM-DD or null). Return ONLY JSON.`;
  const res = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST", headers:{"Authorization":`Bearer ${OPENAI_API_KEY}`,"Content-Type":"application/json"},
    body: JSON.stringify({ model:"gpt-4o", temperature:0,
      messages:[{role:"user",content:[{type:"text",text:prompt},{type:"image_url",image_url:{url:publicUrl}}]}] })
  }).catch(()=>null);
  const j = await res?.json().catch(()=>null);
  const t = j?.choices?.[0]?.message?.content || "{}";
  try { return JSON.parse(t); } catch { return {}; }
}

// Generate QR, save, send
async function generateAndSendQR(to:string, userId:string, ctx:any){
  const ussd = buildUSSD(ctx);
  
  // Use web service to generate QR code
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ussd)}`;
  const qrResponse = await fetch(qrUrl);
  const qrBytes = new Uint8Array(await qrResponse.arrayBuffer());
  
  const path = `${userId}/${crypto.randomUUID()}.png`;
  const { error } = await sb.storage.from("qr-codes").upload(path, qrBytes, { contentType:"image/png", upsert:true });
  if(error) throw error;
  
  await sb.from("qr_generations").insert({ user_id:userId, profile_id: ctx.qr?.profile_id ?? null, amount: ctx.qr?.amount ?? null, ussd, file_path:path });
  
  const publicUrl = `${SB_URL}/storage/v1/object/public/qr-codes/${path}`;
  const tel = buildTel(ussd);
  
  await image(to, publicUrl, `USSD: ${ussd}\nTap to dial: ${tel}`);
  await btns(to,"QR generated. Next action?",[
    {id:"QR_AGAIN", title:"Generate another"},
    {id:"QR_CHANGE_DEFAULT", title:"Change default"},
    {id:"HOME", title:"⬅️ Home"}
  ]);
}

// Menus
async function showMainMenu(to:string){
  await btns(to, "Welcome. Choose a service:", [
    {id:"MOBILITY", title:"🚕 Mobility"},
    {id:"INSURANCE", title:"🛡️ Insurance (Moto)"},
    {id:"QR", title:"🔳 QR Codes"},
    {id:"PROFILE", title:"👤 My Profile"}
  ]);
}
async function showMobilityMenu(to:string){
  await btns(to, "Mobility menu:", [
    {id:"ND", title:"Nearby Drivers"},
    {id:"ST", title:"Schedule Trip"},
    {id:"AV", title:"Add Vehicle (OCR)"},
    {id:"HOME", title:"⬅️ Home"}
  ]);
}
async function showQRMenu(to:string){
  await btns(to, "QR: Choose identifier type:", [
    {id:"QR_PHONE", title:"Use Phone"},
    {id:"QR_CODE", title:"Use MoMo Code"},
    {id:"HOME", title:"⬅️ Home"}
  ]);
}

// Insurance helpers
const fetchPeriods = () => sb.from("insurance_periods").select("*").eq("is_active",true);
const fetchAddons = () => sb.from("addons").select("*").eq("is_active",true);
const fetchPA = () => sb.from("pa_categories").select("*").eq("is_active",true);

// Entry
Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname === "/") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === WABA_VERIFY) return new Response(challenge ?? "", {status:200});
    return bad("Verification failed",403);
  }
  if (req.method !== "POST") return ok({ok:true});

  const body = await req.json().catch(()=> ({}));
  await sb.from("whatsapp_logs").insert({ 
    direction:"in", 
    phone_number: body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.wa_id || "unknown",
    message_type: body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.type || "unknown",
    message_content: JSON.stringify(body),
    metadata: {},
    status: "received"
  });
  const entry = body?.entry?.[0]; const change = entry?.changes?.[0]?.value;
  const m = change?.messages?.[0]; const contact = change?.contacts?.[0];
  if(!m || !contact) return ok({});
  const from = `+${contact.wa_id}`; const name = contact?.profile?.name;
  const { user, session } = await getOrCreateUser(from, name);
  const to = from;

  // Interactive?
  const iid = getInteractiveId(m);
  if (iid) {
    // Main navigation
    if (iid === "MOBILITY") { await setState(session.id,"MOBILITY_MENU",{}); await showMobilityMenu(to); return ok({}); }
    if (iid === "INSURANCE") {
      await setState(session.id, INS_STATES.CHECK, {});
      // Do we have any vehicle?
      const { data: vs } = await sb.from("vehicles").select("*").eq("user_id",user.user_id || user.id).limit(1);
      if (!vs?.length) {
        await setState(session.id, INS_STATES.COLLECT, {});
        await text(to, "Please send:\n1) Carte Jaune (photo/PDF)\n2) Old Insurance (photo/PDF)\nReply 'Agent' for human support.\nSend 'Done' when finished.");
      } else {
        await setState(session.id, INS_STATES.START, { vehicle_id: vs[0].id, plate: vs[0].plate });
        await btns(to, `Insurance for ${vs[0].plate ?? 'your vehicle'} — Start date?`, [
          {id:"START_TODAY", title:"Today"},
          {id:"START_PICK", title:"Pick date"}
        ]);
      }
      return ok({});
    }
    if (iid === "QR") { await setState(session.id,"QR_MENU",{}); await showQRMenu(to); return ok({}); }
    if (iid === "PROFILE") {
      await text(to, `Phone: ${user.wa_phone}\nDefault MoMo: ${user.default_momo_phone ?? '—'}\nCode: ${user.default_momo_code ?? '—'}`);
      await showMainMenu(to); return ok({});
    }
    if (iid === "HOME") { await setState(session.id,"MAIN_MENU",{}); await showMainMenu(to); return ok({}); }

    // Mobility subflows
    if (iid === "ND") {
      await setState(session.id,"ND_SELECT_TYPE",{});
      const { data: types } = await sb.from("vehicle_types").select("*");
      await list(to,"Choose vehicle type:", (types||[]).map((t:any)=>({id:`ND_V_${t.code}`, title:t.label})), "Vehicle Types","Nearby");
      return ok({});
    }
    if (iid === "ST") {
      await setState(session.id,"ST_ROLE",{});
      await btns(to,"Schedule Trip: choose role",[
        {id:"ST_ROLE_PAX", title:"Passenger"},
        {id:"ST_ROLE_DRV", title:"Driver"},
        {id:"MOBILITY", title:"⬅️ Back"}
      ]); return ok({});
    }
    if (iid === "AV") {
      await setState(session.id,"AV_USAGE",{});
      const { data: vtypes } = await sb.from("vehicle_types").select("*");
      await list(to,"Usage type:", (vtypes||[]).map((t:any)=>({id:`AV_U_${t.code}`, title:t.label})), "Usage Types","Add Vehicle");
      return ok({});
    }
    if (iid.startsWith("ND_V_")) {
      const vt = iid.replace("ND_V_","");
      await setState(session.id,"ND_WAIT_LOCATION",{ nd:{vehicle_type:vt} });
      await text(to,"Share your pickup location (Attach → Location).");
      return ok({});
    }
    if (iid.startsWith("AV_U_")) {
      const usage = iid.replace("AV_U_","");
      await setState(session.id,"AV_DOC",{ av:{usage_type:usage} });
      await text(to,"Upload insurance certificate (photo or PDF).");
      return ok({});
    }

    // QR subflows
    if (iid === "QR_PHONE") {
      await setState(session.id,"QR_PHONE",{ qr:{type:"phone"} });
      if(!user.default_momo_phone){ await text(to,"Enter MoMo phone (07xxxxxxxx or +2507…)"); }
      else {
        await setState(session.id,"QR_AMOUNT_MODE",{ qr:{type:"phone", phone:user.default_momo_phone} });
        await btns(to,"Amount mode:",[
          {id:"QR_AMT_WITH", title:"With amount"},
          {id:"QR_AMT_NONE", title:"No amount"},
          {id:"QR", title:"⬅️ Back"}]);
      }
      return ok({});
    }
    if (iid === "QR_CODE") {
      await setState(session.id,"QR_CODE",{ qr:{type:"code"} });
      if(!user.default_momo_code){ await text(to,"Enter MoMo merchant code (4–9 digits):"); }
      else {
        await setState(session.id,"QR_AMOUNT_MODE",{ qr:{type:"code", code:user.default_momo_code} });
        await btns(to,"Amount mode:",[
          {id:"QR_AMT_WITH", title:"With amount"},
          {id:"QR_AMT_NONE", title:"No amount"},
          {id:"QR", title:"⬅️ Back"}]);
      }
      return ok({});
    }
    if (iid === "QR_AMT_WITH") {
      await setState(session.id,"QR_AMOUNT_INPUT",{ qr:{...(session.context as any).qr} });
      await list(to,"Quick pick:",[
        {id:"QR_A_1000", title:"1,000"},
        {id:"QR_A_2000", title:"2,000"},
        {id:"QR_A_5000", title:"5,000"},
        {id:"QR_A_OTHER", title:"Other amount"}],"Amounts","Pick amount");
      return ok({});
    }
    if (iid === "QR_AMT_NONE") {
      const ctx = session.context as any; ctx.qr = { ...(ctx.qr||{}), amount:null };
      await setState(session.id,"QR_GENERATE",ctx); await generateAndSendQR(to, user.id, ctx); return ok({});
    }
    if (["QR_A_1000","QR_A_2000","QR_A_5000"].includes(iid)) {
      const amt = iid==="QR_A_1000"?1000: iid==="QR_A_2000"?2000: 5000;
      const ctx = session.context as any; ctx.qr = { ...(ctx.qr||{}), amount:amt };
      await setState(session.id,"QR_GENERATE",ctx); await generateAndSendQR(to, user.id, ctx); return ok({});
    }
    if (iid === "QR_A_OTHER") { await text(to,"Enter amount (>0):"); return ok({}); }
    if (iid === "QR_AGAIN") { await showQRMenu(to); return ok({}); }
    if (iid === "QR_CHANGE_DEFAULT") {
      const ctx = session.context as any;
      if(ctx.qr?.type==="phone"){ await setState(session.id,"QR_PHONE",{ qr:{type:"phone"} }); await text(to,"Enter new default MoMo phone:"); }
      else { await setState(session.id,"QR_CODE",{ qr:{type:"code"} }); await text(to,"Enter new default MoMo code (4–9 digits):"); }
      return ok({});
    }

    // Insurance: start date → period → addons → summary
    if (session.state === INS_STATES.START) {
      if (iid === "START_TODAY") {
        const ctx = { ...(session.context||{}), start_date: new Date().toISOString().slice(0,10) };
        await setState(session.id, INS_STATES.PERIOD, ctx);
        const { data: periods=[] } = await fetchPeriods();
        await list(to,"Choose duration", periods.map((p:any)=>({id:`PERIOD_${p.id}`,title:p.label,description:`${p.days} days`})), "Period","Available");
        return ok({});
      }
      if (iid === "START_PICK") { await text(to,"Send date as YYYY-MM-DD:"); return ok({}); }
    }
    if (session.state === INS_STATES.PERIOD && iid.startsWith("PERIOD_")) {
      const ctx = { ...(session.context||{}), period_id: iid.replace("PERIOD_","") };
      await setState(session.id, INS_STATES.ADDONS, ctx);
      const { data: addons=[] } = await fetchAddons();
      await list(to,"Pick add-ons (send 'Done' to continue)", addons.map((a:any)=>({id:`ADDON_${a.id}`,title:a.label,description:a.code})), "Add-ons","Available");
      return ok({});
    }
    if (session.state === INS_STATES.SUMMARY) {
      if (iid === "SUM_CONTINUE") {
        const c = session.context as any;
        const { data: ins } = await sb.from("insurance_quotes").insert({
          user_id: user.id,
          vehicle_id: c.vehicle_id ?? null,
          start_date: c.start_date,
          period_id: c.period_id,
          addons: c.addons ?? [],
          pa_category_id: c.pa_category_id ?? null,
          status: "pending_backoffice"
        }).select("id").single();
        await setState(session.id, INS_STATES.QUEUED, { quote_id: ins!.id });
        await text(to,"Preparing quotation… Backoffice will attach the PDF shortly.");
        return ok({});
      }
      if (iid === "CANCEL") { await setState(session.id,"MAIN_MENU",{}); await showMainMenu(to); return ok({}); }
    }
    if (session.state === INS_STATES.DECIDE) {
      if (iid === "PROCEED") {
        await setState(session.id, INS_STATES.PLAN, session.context);
        const { data: plans=[] } = await sb.from("payment_plans").select("*").eq("is_active",true);
        await list(to,"Payment plan:", plans.map((p:any)=>({id:`PLAN_${p.id}`,title:p.label,description:p.description||""})),"Payment Plans","Plans");
        return ok({});
      }
      if (iid === "ASK_CHANGES") { await text(to,"A human agent will join to adjust your quote."); return ok({}); }
      if (iid === "CANCEL") { await setState(session.id,"MAIN_MENU",{}); await showMainMenu(to); return ok({}); }
    }
    if (session.state === INS_STATES.PLAN && iid.startsWith("PLAN_")) {
      const ctx = { ...(session.context||{}), payment_plan_id: iid.replace("PLAN_","") };
      await setState(session.id, INS_STATES.AWAIT, ctx);
      const qId = (ctx as any).quote_id;
      const q = await sb.from("insurance_quotes").select("amount_cents").eq("id",qId).single();
      const amount = Math.max(q.data?.amount_cents || 0, 0);
      const local = user.default_momo_phone ? user.default_momo_phone : user.wa_phone;
      const ussd = `*182*1*1*${local.replace('+250','0').replace('+','')}*${amount}#`;
      await btns(to, `Tap to pay: ${buildTel(ussd)}`, [
        {id:"PAID", title:"I paid"},
        {id:"REMIND_ME", title:"Remind me later"}
      ]);
      return ok({});
    }
    if (session.state === INS_STATES.AWAIT) {
      if (iid === "PAID") { await text(to,"We are checking your payment…"); return ok({}); }
      if (iid === "REMIND_ME") { await text(to,"We'll remind you in ~10 minutes if not received."); return ok({}); }
    }

    // Fallback to main menu
    await showMainMenu(to);
    return ok({});
  }

  // Non-interactive types
  // Location → Nearby drivers
  if (m?.location && session.state === "ND_WAIT_LOCATION") {
    const p = { lat: m.location.latitude, lng: m.location.longitude };
    const { data: drivers=[] , error } = await sb.rpc("nearby_drivers", { lat:p.lat, lng:p.lng, km: 15 });
    if (error || !drivers.length) { await text(to,"No drivers nearby right now. Try again later."); await showMobilityMenu(to); return ok({}); }
    const rows = drivers.map((d:any,i:number)=>({ id:`ND_BOOK_${d.driver_id}`, title:`#${i+1} ${d.wa_name||'Driver'} — ${d.distance_km.toFixed(1)} km` }));
    await sb.from("chat_sessions").update({ state:"ND_CHOOSE_DRIVER", context:{ nd:{pickup:p,drivers} } }).eq("id",session.id);
    await list(to,"Top-10 nearby drivers:", rows, "Drivers","Nearby");
    return ok({});
  }

  // Media (images/pdfs) → AV_DOC or INS_COLLECT_DOCS
  if (m?.image || m?.document) {
    const mediaId = m.image?.id || m.document?.id;
    if (mediaId) {
      const { bytes, mime } = await fetchMedia(mediaId);
      const ext = mime.includes("pdf")? "pdf":"jpg";
      const path = `docs/${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage.from("vehicle-docs").upload(path, bytes, { contentType: mime, upsert:true });
      if (!up.error) {
        const { data: signed } = await sb.storage.from("vehicle-docs").createSignedUrl(path, 600);
        if (session.state === "AV_DOC") {
          const ocr = await ocrVehicleDoc(signed!.signedUrl);
          const usage = (session.context as any).av?.usage_type;
          await sb.from("vehicles").insert({
            user_id:user.id, usage_type:usage, plate:ocr.plate||null, vin:ocr.vin||null,
            make:ocr.make||null, model:ocr.model||null, model_year:ocr.model_year||null,
            insurance_provider:ocr.insurance_provider||null, insurance_policy:ocr.insurance_policy||null,
            insurance_expiry:ocr.insurance_expiry||null, doc_url:path, verified:false, extra:ocr
          });
          await setState(session.id,"MOBILITY_MENU",{});
          await text(to,`Vehicle saved: ${ocr.plate ?? '(no plate parsed)'}\nVerification pending.`);
          await showMobilityMenu(to);
          return ok({});
        }
        if (session.state === INS_STATES.COLLECT) {
          // Accept multiple; user replies 'Done' to proceed
          await text(to,"Received document. Send more or reply 'Done' to continue.");
          return ok({});
        }
      }
    }
  }

  // Text inputs for QR / Insurance
  if (m?.text?.body) {
    const t = m.text.body.trim();
    if (session.state === "QR_PHONE") {
      const phone = normalizePhone(t);
      await sb.from("profiles").update({ default_momo_phone:phone }).eq("id",user.id);
      await setState(session.id,"QR_AMOUNT_MODE",{ qr:{type:"phone", phone} });
      await btns(to,"Amount mode:",[
        {id:"QR_AMT_WITH", title:"With amount"},
        {id:"QR_AMT_NONE", title:"No amount"},
        {id:"QR", title:"⬅️ Back"}]);
      return ok({});
    }
    if (session.state === "QR_CODE") {
      if(!/^\d{4,9}$/.test(t)){ await text(to,"Invalid code. Enter 4–9 digits:"); return ok({}); }
      await sb.from("profiles").update({ default_momo_code:t }).eq("id",user.id);
      await setState(session.id,"QR_AMOUNT_MODE",{ qr:{type:"code", code:t} });
      await btns(to,"Amount mode:",[
        {id:"QR_AMT_WITH", title:"With amount"},
        {id:"QR_AMT_NONE", title:"No amount"},
        {id:"QR", title:"⬅️ Back"}]);
      return ok({});
    }
    if (session.state === "QR_AMOUNT_INPUT") {
      const amt = parseInt(t.replace(/[^\d]/g,''),10);
      if(!amt || amt<=0){ await text(to,"Amount must be > 0. Enter again:"); return ok({}); }
      const ctx = (await sb.from("chat_sessions").select("context").eq("id",session.id).single()).data!.context as any;
      ctx.qr = { ...(ctx.qr||{}), amount: amt };
      await setState(session.id,"QR_GENERATE",ctx);
      await generateAndSendQR(to, user.id, ctx);
      return ok({});
    }
    if (session.state === INS_STATES.COLLECT) {
      if (t.toLowerCase() === "agent") { await text(to,"A human agent will join shortly. Please describe the issue."); return ok({}); }
      if (t.toLowerCase() === "done") {
        await setState(session.id, INS_STATES.START, {});
        await btns(to,"Start date?",[
          {id:"START_TODAY", title:"Today"},
          {id:"START_PICK", title:"Pick date"}]);
        return ok({});
      }
    }
    if (session.state === INS_STATES.START && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const ctx = { ...(session.context||{}), start_date: t };
      await setState(session.id, INS_STATES.PERIOD, ctx);
      const { data: periods=[] } = await fetchPeriods();
      await list(to,"Choose duration", periods.map((p:any)=>({id:`PERIOD_${p.id}`,title:p.label,description:`${p.days} days`})), "Period","Available");
      return ok({});
    }
    if (session.state === INS_STATES.ADDONS) {
      const c = session.context as any;
      if (!c.addons) c.addons = [];
      // Allow 'Done' to move on
      if (t.toLowerCase() === "done") {
        // If PA included (by code), require PA category
        // (Admin can use addon code 'pa' to signal this. If not present, skip.)
        const { data: ads=[] } = await fetchAddons();
        const pa = ads.find((a:any)=> a.code?.toLowerCase() === 'pa');
        if (pa && c.addons.includes(pa.id)) {
          await setState(session.id, INS_STATES.PA, c);
          const { data: cats=[] } = await fetchPA();
          await list(to,"Personal Accident category", cats.map((p:any)=>({id:`PA_${p.id}`,title:p.label})),"PA","Categories");
          return ok({});
        } else {
          await setState(session.id, INS_STATES.SUMMARY, c);
          await btns(to,"Summary → Continue?",[
            {id:"SUM_CONTINUE", title:"Continue"},
            {id:"CANCEL", title:"Cancel"}]);
          return ok({});
        }
      }
      // If the user tapped list rows, we handle in interactive branch; here just guide
      await text(to,"Pick add-ons from the list or send 'Done'.");
      return ok({});
    }
    if (session.state === INS_STATES.PA && t) {
      await text(to,"Please choose PA category from the list.");
      return ok({});
    }
  }

  // Default to main menu
  await showMainMenu(to);
  return ok({});
});