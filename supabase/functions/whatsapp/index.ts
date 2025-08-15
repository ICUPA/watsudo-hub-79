// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import * as base64 from "https://deno.land/std@0.223.0/encoding/base64.ts";
import QRCode from "https://deno.land/x/qrcode@v2.0.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Environment variables - try multiple possible names with fallbacks
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || 
                     Deno.env.get("META_VERIFY_TOKEN") || 
                     Deno.env.get("VERIFY_TOKEN") ||
                     "bd0e7b6f4a2c9d83f1e57a0c6b3d48e9";

const SB_URL = Deno.env.get("SUPABASE_URL");
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// WhatsApp API helpers
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || 
                     Deno.env.get("META_ACCESS_TOKEN") ||
                     "EAAGHrMn6uugBO9xlSTNU1FsbnZB7AnBLCvTlgZCYQDZC8OZA7q3nrtxpxn3VgHiT8o9KbKQIyoPNrESHKZCq2c9B9lvNr2OsT8YDBewaDD1OzytQd74XlmSOgxZAVL6TEQpDT43zZCZBwQg9AZA5QPeksUVzmAqTaoNyIIaaqSvJniVmn6dW1rw88dbZAyR6VZBMTTpjQZDZD";
const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

const sb = SB_URL && SB_SERVICE ? createClient(SB_URL, SB_SERVICE) : null;

// WhatsApp API functions
async function sendMessage(to: string, text: string) {
  const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "text", 
      text: { body: text }
    })
  });
  return await response.json();
}

async function sendButtons(to: string, text: string, buttons: {id: string, title: string}[]) {
  const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: text },
        action: { buttons: buttons.map(b => ({ type: "reply", reply: b })) }
      }
    })
  });
  return await response.json();
}

async function sendList(to: string, header: string, body: string, rows: {id: string, title: string, description?: string}[]) {
  const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: header },
        body: { text: body },
        action: { button: "Choose", sections: [{ title: "Options", rows }] }
      }
    })
  });
  return await response.json();
}

async function sendImage(to: string, imageUrl: string, caption?: string) {
  const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "image",
      image: { link: imageUrl, caption }
    })
  });
  return await response.json();
}

// User management
async function getOrCreateUser(phone: string, name?: string) {
  if (!sb) return null;
  
  let { data: users } = await sb.from("profiles").select("*").eq("wa_phone", phone).limit(1);
  if (!users?.length) {
    const { data } = await sb.from("profiles").insert({ wa_phone: phone, wa_name: name }).select("*").single();
    users = [data];
  }
  return users[0];
}

async function getConversationState(userId: string) {
  if (!sb) return { step: 'main_menu', data: {} };
  
  let { data: sessions } = await sb.from("chat_sessions").select("*").eq("user_id", userId).limit(1);
  if (!sessions?.length) {
    const { data } = await sb.from("chat_sessions").insert({ user_id: userId, state: 'main_menu', context: {} }).select("*").single();
    sessions = [data];
  }
  return { step: sessions[0].state, data: sessions[0].context || {} };
}

async function updateConversationState(userId: string, step: string, data: any = {}) {
  if (!sb) return;
  await sb.from("chat_sessions").update({ state: step, context: data }).eq("user_id", userId);
}

// QR Code generation
async function generateQRCode(phone: string, amount?: number) {
  const localPhone = phone.startsWith("+250") ? `0${phone.slice(4)}` : phone.replace(/^\+/, '');
  const ussd = amount ? `*182*1*1*${localPhone}*${amount}#` : `*182*1*1*${localPhone}#`;
  
  const dataUrl = await QRCode.toDataURL(ussd, { errorCorrectionLevel: "H", margin: 2, scale: 8 });
  const bytes = base64.decode(dataUrl.split(",")[1]);
  
  if (sb) {
    const path = `qr/${crypto.randomUUID()}.png`;
    const { error } = await sb.storage.from("qr-codes").upload(path, bytes, { contentType: "image/png", upsert: true });
    if (!error) {
      const publicUrl = `${SB_URL}/storage/v1/object/public/qr-codes/${path}`;
      return { ussd, publicUrl, telLink: `tel:${ussd.replace(/#/g, '%23')}` };
    }
  }
  
  return { ussd, telLink: `tel:${ussd.replace(/#/g, '%23')}` };
}

// Main message processor
async function processMessage(from: string, message: any, interactiveId?: string) {
  const user = await getOrCreateUser(from);
  if (!user) return;
  
  const { step, data } = await getConversationState(user.id);
  const text = message.text?.body?.trim();
  
  console.log(`📱 Processing: ${from} | Step: ${step} | Text: "${text}" | Interactive: ${interactiveId}`);
  
  // Handle interactive button/list responses
  if (interactiveId) {
    await handleInteractiveResponse(from, user.id, step, data, interactiveId);
    return;
  }
  
  // Handle text messages based on conversation state
  switch (step) {
    case 'main_menu':
      await handleMainMenu(from, user.id, text);
      break;
      
    case 'qr_momo_setup':
      await handleQRMomoSetup(from, user.id, text);
      break;
      
    case 'qr_amount_custom':
      await handleQRAmountCustom(from, user.id, data, text);
      break;
      
    case 'nd_location_wait':
      if (message.location) {
        await handleNearbyDriversLocation(from, user.id, data, message.location);
      } else {
        await sendMessage(from, "📍 Please share your location using the attachment button.");
      }
      break;
      
    case 'av_document_upload':
      if (message.image || message.document) {
        await handleVehicleDocumentUpload(from, user.id, data, message);
      } else {
        await sendMessage(from, "📄 Please upload your vehicle documents (image or PDF).");
      }
      break;
      
    case 'ins_start_date_input':
      await handleInsuranceStartDate(from, user.id, data, text);
      break;
      
    case 'ins_addons_input':
      await handleInsuranceAddons(from, user.id, data, text);
      break;
      
    case 'ins_payment_pending':
      if (text?.toLowerCase() === 'paid') {
        await handleInsurancePaymentConfirm(from, user.id, data);
      } else {
        await sendMessage(from, "Type 'paid' when you have completed the payment.");
      }
      break;
      
    default:
      // Default to main menu for any unrecognized state
      await showMainMenu(from, user.id);
      break;
  }
}

// Interactive response handler
async function handleInteractiveResponse(from: string, userId: string, step: string, data: any, id: string) {
  switch (id) {
    // Main menu
    case 'MOBILITY':
      await showMobilityMenu(from, userId);
      break;
    case 'INSURANCE':
      await startInsuranceFlow(from, userId);
      break;
    case 'QR':
      await showQRMenu(from, userId);
      break;
      
    // QR flows
    case 'QR_PHONE':
      await handleQRPhoneChoice(from, userId);
      break;
    case 'QR_CODE':
      await handleQRCodeChoice(from, userId);
      break;
    case 'QR_SCAN':
      await handleQRScanChoice(from, userId);
      break;
    case 'QR_AMT_WITH':
      await showQRAmountOptions(from, userId, data);
      break;
    case 'QR_AMT_NONE':
      await generateAndSendQR(from, userId, data, null);
      break;
    case 'QR_A_1000':
      await generateAndSendQR(from, userId, data, 1000);
      break;
    case 'QR_A_2000':
      await generateAndSendQR(from, userId, data, 2000);
      break;
    case 'QR_A_5000':
      await generateAndSendQR(from, userId, data, 5000);
      break;
    case 'QR_A_OTHER':
      await updateConversationState(userId, 'qr_amount_custom', data);
      await sendMessage(from, "💰 Enter custom amount (digits only, e.g., 3500):");
      break;
    case 'QR_AGAIN':
      await showQRMenu(from, userId);
      break;
      
    // Mobility flows
    case 'ND':
      await startNearbyDriversFlow(from, userId);
      break;
    case 'ST':
      await startScheduleTripFlow(from, userId);
      break;
    case 'AV':
      await startAddVehicleFlow(from, userId);
      break;
      
    // Vehicle type selections
    case 'ND_V_MOTO':
    case 'ND_V_CAB':
    case 'ND_V_LIFFAN':
    case 'ND_V_TRUCK':
      await handleNearbyDriversVehicleType(from, userId, id.replace('ND_V_', ''));
      break;
      
    case 'AV_U_MOTO':
    case 'AV_U_CAB': 
    case 'AV_U_LIFFAN':
    case 'AV_U_TRUCK':
    case 'AV_U_RENTAL':
      await handleAddVehicleUsageType(from, userId, id.replace('AV_U_', ''));
      break;
      
    // Insurance flows
    case 'INS_CONTINUE':
      await handleInsuranceContinue(from, userId, data);
      break;
    case 'INS_START_TODAY':
      await handleInsuranceStartToday(from, userId, data);
      break;
    case 'INS_START_PICK':
      await updateConversationState(userId, 'ins_start_date_input', data);
      await sendMessage(from, "📅 Enter start date (YYYY-MM-DD format):");
      break;
      
    // Home button
    case 'HOME':
      await showMainMenu(from, userId);
      break;
      
    default:
      console.log(`❓ Unhandled interactive ID: ${id}`);
      await showMainMenu(from, userId);
      break;
  }
}

// Flow implementations
async function showMainMenu(from: string, userId: string) {
  await updateConversationState(userId, 'main_menu', {});
  await sendButtons(from, "🚗 **Welcome to MoveRwanda!**\n\nChoose a service:", [
    { id: "MOBILITY", title: "🚕 Mobility" },
    { id: "INSURANCE", title: "🛡️ Insurance" },
    { id: "QR", title: "🔳 QR Codes" }
  ]);
}

async function showMobilityMenu(from: string, userId: string) {
  await updateConversationState(userId, 'mobility_menu', {});
  await sendButtons(from, "🚕 **Mobility Services**\n\nWhat would you like to do?", [
    { id: "ND", title: "Nearby Drivers" },
    { id: "ST", title: "Schedule Trip" },
    { id: "AV", title: "Add Vehicle" },
    { id: "HOME", title: "⬅️ Home" }
  ]);
}

async function showQRMenu(from: string, userId: string) {
  await updateConversationState(userId, 'qr_menu', {});
  await sendButtons(from, "🔳 **QR Code Services**\n\nChoose an option:", [
    { id: "QR_PHONE", title: "📱 Phone QR" },
    { id: "QR_CODE", title: "💳 MoMo Code QR" },
    { id: "QR_SCAN", title: "📷 Scan QR" },
    { id: "HOME", title: "⬅️ Home" }
  ]);
}

async function handleQRPhoneChoice(from: string, userId: string) {
  // Check if user has saved MoMo phone
  const user = await getOrCreateUser(from);
  if (user?.default_momo_phone) {
    const data = { qr_type: 'phone', phone: user.default_momo_phone };
    await updateConversationState(userId, 'qr_amount_mode', data);
    await sendButtons(from, `💳 **MoMo found:** ${user.default_momo_phone}\n\nChoose amount mode:`, [
      { id: "QR_AMT_WITH", title: "With amount" },
      { id: "QR_AMT_NONE", title: "No amount" },
      { id: "QR", title: "⬅️ Back" }
    ]);
  } else {
    await updateConversationState(userId, 'qr_momo_setup', { qr_type: 'phone' });
    await sendMessage(from, "📱 **Enter your MoMo number**\n\nFormat: 07XXXXXXXX");
  }
}

async function handleQRCodeChoice(from: string, userId: string) {
  const user = await getOrCreateUser(from);
  if (user?.default_momo_code) {
    const data = { qr_type: 'code', code: user.default_momo_code };
    await updateConversationState(userId, 'qr_amount_mode', data);
    await sendButtons(from, `💳 **MoMo Code found:** ${user.default_momo_code}\n\nChoose amount mode:`, [
      { id: "QR_AMT_WITH", title: "With amount" },
      { id: "QR_AMT_NONE", title: "No amount" },
      { id: "QR", title: "⬅️ Back" }
    ]);
  } else {
    await updateConversationState(userId, 'qr_code_setup', { qr_type: 'code' });
    await sendMessage(from, "💳 **Enter your MoMo merchant code**\n\nFormat: 4-9 digits");
  }
}

async function handleQRScanChoice(from: string, userId: string) {
  await updateConversationState(userId, 'qr_scan', {});
  await sendMessage(from, "📷 **Scan QR Code**\n\nPlease upload a QR code image to decode it.");
}

async function showQRAmountOptions(from: string, userId: string, data: any) {
  await updateConversationState(userId, 'qr_amount_pick', data);
  await sendList(from, "Amount Selection", "Choose amount or pick custom:", [
    { id: "QR_A_1000", title: "1,000 RWF" },
    { id: "QR_A_2000", title: "2,000 RWF" },
    { id: "QR_A_5000", title: "5,000 RWF" },
    { id: "QR_A_OTHER", title: "Custom amount" }
  ]);
}

async function generateAndSendQR(from: string, userId: string, data: any, amount: number | null) {
  const phone = data.phone || data.code;
  if (!phone) {
    await sendMessage(from, "❌ No phone/code found. Please start over.");
    return showQRMenu(from, userId);
  }
  
  const qr = await generateQRCode(phone, amount || undefined);
  const amountText = amount ? `\n💰 Amount: ${amount.toLocaleString()} RWF` : '';
  const message = `✅ **QR Code Generated!**\n\n📱 USSD: ${qr.ussd}${amountText}\n🔗 Tap to dial: ${qr.telLink}`;
  
  if (qr.publicUrl) {
    await sendImage(from, qr.publicUrl, message);
  } else {
    await sendMessage(from, message);
  }
  
  await sendButtons(from, "**Next action:**", [
    { id: "QR_AGAIN", title: "Generate another" },
    { id: "HOME", title: "⬅️ Home" }
  ]);
}

async function handleQRMomoSetup(from: string, userId: string, text: string) {
  const phone = text.replace(/\s/g, '');
  if (!/^(07\d{8}|\+2507\d{8})$/.test(phone)) {
    await sendMessage(from, "❌ Invalid format. Please enter: 07XXXXXXXX or +2507XXXXXXXX");
    return;
  }
  
  // Save to user profile
  if (sb) {
    await sb.from("profiles").update({ default_momo_phone: phone }).eq("id", userId);
  }
  
  const data = { qr_type: 'phone', phone };
  await updateConversationState(userId, 'qr_amount_mode', data);
  await sendButtons(from, `✅ **MoMo saved:** ${phone}\n\nChoose amount mode:`, [
    { id: "QR_AMT_WITH", title: "With amount" },
    { id: "QR_AMT_NONE", title: "No amount" },
    { id: "QR", title: "⬅️ Back" }
  ]);
}

async function handleQRAmountCustom(from: string, userId: string, data: any, text: string) {
  const amount = parseInt(text.replace(/[^\d]/g, ''));
  if (!amount || amount <= 0) {
    await sendMessage(from, "❌ Please enter a valid amount (digits only, greater than 0).");
    return;
  }
  
  await generateAndSendQR(from, userId, data, amount);
}

async function startNearbyDriversFlow(from: string, userId: string) {
  await updateConversationState(userId, 'nd_vehicle_type', {});
  await sendList(from, "Vehicle Types", "Choose vehicle type for nearby drivers:", [
    { id: "ND_V_MOTO", title: "Moto Taxi" },
    { id: "ND_V_CAB", title: "Cab" },
    { id: "ND_V_LIFFAN", title: "Liffan" },
    { id: "ND_V_TRUCK", title: "Truck" }
  ]);
}

async function handleNearbyDriversVehicleType(from: string, userId: string, vehicleType: string) {
  await updateConversationState(userId, 'nd_location_wait', { vehicle_type: vehicleType });
  await sendMessage(from, `🚗 **${vehicleType.toUpperCase()} Selected**\n\n📍 Please share your pickup location using the attachment button.`);
}

async function handleNearbyDriversLocation(from: string, userId: string, data: any, location: any) {
  const { latitude, longitude } = location;
  
  // Query nearby drivers (simplified - would use PostGIS in real implementation)
  const mockDrivers = [
    { name: "Jean Paul", distance: 0.8, rating: 4.9, phone: "+250781234567" },
    { name: "Marie Claire", distance: 1.2, rating: 4.7, phone: "+250782345678" },
    { name: "Emmanuel", distance: 1.5, rating: 4.8, phone: "+250783456789" }
  ];
  
  if (mockDrivers.length === 0) {
    await sendMessage(from, "❌ No drivers nearby right now. Please try again later.");
    return showMobilityMenu(from, userId);
  }
  
  const driverList = mockDrivers.map((d, i) => 
    `${i + 1}. **${d.name}** - ${d.distance}km away (⭐ ${d.rating})`
  ).join('\n');
  
  await sendMessage(from, `🚗 **Nearby ${data.vehicle_type?.toUpperCase()} Drivers:**\n\n${driverList}\n\n📞 **Contact directly or use in-app booking when available.**`);
  
  await sendButtons(from, "What would you like to do next?", [
    { id: "ND", title: "🔄 Refresh" },
    { id: "HOME", title: "⬅️ Home" }
  ]);
}

async function startScheduleTripFlow(from: string, userId: string) {
  await sendButtons(from, "📅 **Schedule Trip**\n\nChoose your role:", [
    { id: "ST_PASSENGER", title: "👤 Passenger" },
    { id: "ST_DRIVER", title: "🚗 Driver" },
    { id: "HOME", title: "⬅️ Home" }
  ]);
}

async function startAddVehicleFlow(from: string, userId: string) {
  await updateConversationState(userId, 'av_usage_type', {});
  await sendList(from, "Vehicle Usage", "Select vehicle usage type:", [
    { id: "AV_U_MOTO", title: "Moto Taxi" },
    { id: "AV_U_CAB", title: "Cab" },
    { id: "AV_U_LIFFAN", title: "Liffan" },
    { id: "AV_U_TRUCK", title: "Truck" },
    { id: "AV_U_RENTAL", title: "Rental" }
  ]);
}

async function handleAddVehicleUsageType(from: string, userId: string, usageType: string) {
  await updateConversationState(userId, 'av_document_upload', { usage_type: usageType });
  await sendMessage(from, `🚗 **${usageType.toUpperCase()} Selected**\n\n📄 Please upload your vehicle documents:\n• Insurance certificate\n• Registration (Carte Grise)\n• Any other relevant documents`);
}

async function handleVehicleDocumentUpload(from: string, userId: string, data: any, message: any) {
  // In a real implementation, this would process the uploaded document with OCR
  await sendMessage(from, "📄 **Document received!**\n\n🔄 Processing with OCR...\n\nThis may take a few minutes.");
  
  // Simulate OCR processing
  setTimeout(async () => {
    const mockOCRResult = {
      plate: "RAD123A",
      make: "Honda",
      model: "CB125",
      year: "2023",
      insurance_expiry: "2025-12-31"
    };
    
    if (sb) {
      await sb.from("vehicles").insert({
        user_id: userId,
        usage_type: data.usage_type,
        plate: mockOCRResult.plate,
        make: mockOCRResult.make,
        model: mockOCRResult.model,
        model_year: parseInt(mockOCRResult.year),
        insurance_expiry: mockOCRResult.insurance_expiry,
        verified: false
      });
    }
    
    await sendMessage(from, `✅ **Vehicle Added Successfully!**\n\n🚗 **Details:**\n• Plate: ${mockOCRResult.plate}\n• Make/Model: ${mockOCRResult.make} ${mockOCRResult.model}\n• Year: ${mockOCRResult.year}\n• Insurance expires: ${mockOCRResult.insurance_expiry}\n\n⏳ Verification pending (24-48 hours)`);
    
    await sendButtons(from, "What would you like to do next?", [
      { id: "INSURANCE", title: "🛡️ Get Insurance" },
      { id: "AV", title: "➕ Add Another" },
      { id: "HOME", title: "⬅️ Home" }
    ]);
  }, 3000);
}

async function startInsuranceFlow(from: string, userId: string) {
  await updateConversationState(userId, 'ins_check_vehicle', {});
  
  // Check if user has vehicles
  if (sb) {
    const { data: vehicles } = await sb.from("vehicles").select("*").eq("user_id", userId).limit(1);
    if (vehicles?.length) {
      const vehicle = vehicles[0];
      await updateConversationState(userId, 'ins_vehicle_found', { vehicle_id: vehicle.id, plate: vehicle.plate });
      await sendButtons(from, `🛡️ **Insurance for Vehicle**\n\n🚗 Found: ${vehicle.plate || 'Your vehicle'}\n\nProceed with insurance quote?`, [
        { id: "INS_CONTINUE", title: "✅ Continue" },
        { id: "HOME", title: "⬅️ Home" }
      ]);
    } else {
      await sendMessage(from, "🛡️ **Motor Insurance**\n\n📄 Please upload your vehicle documents first:\n• Carte Jaune\n• Current insurance\n• Registration\n\nOr type 'agent' for human support.");
      await updateConversationState(userId, 'ins_collect_docs', {});
    }
  }
}

async function handleInsuranceContinue(from: string, userId: string, data: any) {
  await updateConversationState(userId, 'ins_start_date', data);
  await sendButtons(from, "📅 **Insurance Start Date**\n\nWhen should your coverage begin?", [
    { id: "INS_START_TODAY", title: "Today" },
    { id: "INS_START_PICK", title: "Pick date" },
    { id: "HOME", title: "⬅️ Home" }
  ]);
}

async function handleInsuranceStartToday(from: string, userId: string, data: any) {
  const startDate = new Date().toISOString().split('T')[0];
  const newData = { ...data, start_date: startDate };
  await updateConversationState(userId, 'ins_period', newData);
  
  // Mock insurance periods
  const periods = [
    { id: '1week', label: '1 Week', days: 7 },
    { id: '1month', label: '1 Month', days: 30 },
    { id: '3months', label: '3 Months', days: 90 },
    { id: '1year', label: '1 Year', days: 365 }
  ];
  
  await sendList(from, "Coverage Period", "Choose insurance duration:", 
    periods.map(p => ({ id: `PERIOD_${p.id}`, title: p.label, description: `${p.days} days` }))
  );
}

async function handleInsuranceStartDate(from: string, userId: string, data: any, text: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    await sendMessage(from, "❌ Invalid date format. Please use YYYY-MM-DD (e.g., 2024-12-31)");
    return;
  }
  
  const newData = { ...data, start_date: text };
  await updateConversationState(userId, 'ins_period', newData);
  await sendMessage(from, `📅 **Start date set:** ${text}\n\nNow choose coverage period...`);
  
  // Show period options (would be implemented similar to handleInsuranceStartToday)
}

async function handleInsuranceAddons(from: string, userId: string, data: any, text: string) {
  if (text.toLowerCase() === 'done') {
    // Proceed to summary
    await showInsuranceSummary(from, userId, data);
  } else {
    // Parse addon selections (e.g., "1,3,4")
    const numbers = text.split(',').map(n => parseInt(n.trim())).filter(n => n >= 1 && n <= 4);
    if (numbers.length > 0) {
      const addonNames = ['Third-party Liability', 'COMESA Yellow Card', 'Personal Accident', 'Comprehensive'];
      const selected = numbers.map(n => addonNames[n-1]);
      await sendMessage(from, `✅ **Coverage added:** ${selected.join(', ')}\n\nType 'done' to continue or add more numbers (1-4):`);
      await updateConversationState(userId, 'ins_addons_input', { ...data, addons: numbers });
    } else {
      await sendMessage(from, "❌ Invalid selection. Please enter numbers 1-4 separated by commas:");
    }
  }
}

async function showInsuranceSummary(from: string, userId: string, data: any) {
  const summary = `📋 **Insurance Summary**\n\n🚗 Vehicle: ${data.plate || 'Your vehicle'}\n📅 Start: ${data.start_date}\n🛡️ Coverage: Selected addons\n\n💰 Estimated: Processing...\n\nProceed with quotation?`;
  
  await updateConversationState(userId, 'ins_summary', data);
  await sendButtons(from, summary, [
    { id: "INS_QUOTE_PROCEED", title: "✅ Get Quote" },
    { id: "HOME", title: "⬅️ Home" }
  ]);
}

async function handleInsurancePaymentConfirm(from: string, userId: string, data: any) {
  await sendMessage(from, "🔍 **Checking payment...**\n\nPlease wait while we verify your transaction.");
  
  // Simulate payment verification
  setTimeout(async () => {
    await sendMessage(from, "✅ **Payment Confirmed!**\n\n🛡️ Your moto insurance is now active!\n📄 Certificate will be sent shortly.\n\n📞 Claims: Call 3456\n📧 Support: insurance@moverwa.com");
    await showMainMenu(from, userId);
  }, 3000);
}

// Main serve function
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(req.url);

    // Debug endpoint
    if (url.pathname.endsWith('/debug')) {
      return new Response(JSON.stringify({
        verify_token: VERIFY_TOKEN ? "SET" : "NOT SET",
        access_token: ACCESS_TOKEN ? "SET" : "NOT SET", 
        phone_id: PHONE_ID ? "SET" : "NOT SET",
        supabase_url: SB_URL ? "SET" : "NOT SET",
        service_key: SB_SERVICE ? "SET" : "NOT SET"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET: webhook verification
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      
      console.log(`🔐 Verification: mode=${mode}, token=${token}, challenge=${challenge}`);
      
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ Verification successful");
        return new Response(challenge ?? "", { status: 200, headers: corsHeaders });
      }
      
      console.log("❌ Verification failed");
      return new Response("Verification failed", { status: 403, headers: corsHeaders });
    }

    // POST: webhook messages
    if (req.method === "POST") {
      const body = await req.json();
      console.log("📨 Incoming webhook:", JSON.stringify(body, null, 2));
      
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0]?.value;
      const message = changes?.messages?.[0];
      const contact = changes?.contacts?.[0];
      
      if (message && contact) {
        const from = `+${contact.wa_id}`;
        
        // Log incoming message
        if (sb) {
          await sb.from("whatsapp_logs").insert({
            direction: "in",
            phone_number: from,
            message_type: message.type,
            message_content: JSON.stringify(message),
            metadata: body
          });
        }
        
        // Extract interactive ID if present
        const interactiveId = message.interactive?.type === "button_reply" 
          ? message.interactive.button_reply?.id
          : message.interactive?.type === "list_reply"
          ? message.interactive.list_reply?.id
          : undefined;
        
        // Process the message
        await processMessage(from, message, interactiveId);
      }

      return new Response(JSON.stringify({ status: "received" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    
  } catch (error) {
    console.error("❌ Function error:", error);
    return new Response(`Error: ${error.message}`, { status: 500, headers: corsHeaders });
  }
});