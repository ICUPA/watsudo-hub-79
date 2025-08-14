import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VERIFY_TOKEN = 'bd0e7b6f4a2c9d83f1e57a0c6b3d48e9';
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

// Initialize Supabase client with service role for full access
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string };
  document?: { id: string; mime_type: string; filename: string; sha256: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  type: string;
}

interface ConversationState {
  phone_number: string;
  user_id?: string;
  current_step: string;
  conversation_data: any;
}

// ============= CONVERSATION STATE MANAGEMENT =============

async function getConversationState(phoneNumber: string): Promise<ConversationState> {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single();

  if (error || !data) {
    // Create new conversation state
    const newState: ConversationState = {
      phone_number: phoneNumber,
      current_step: 'main_menu',
      conversation_data: {}
    };
    
    const { data: createdState } = await supabase
      .from('whatsapp_conversations')
      .insert(newState)
      .select()
      .single();
    
    return createdState || newState;
  }

  return data;
}

async function updateConversationState(phoneNumber: string, step: string, data: any = {}, userId?: string) {
  await supabase
    .from('whatsapp_conversations')
    .upsert({
      phone_number: phoneNumber,
      user_id: userId,
      current_step: step,
      conversation_data: data,
      last_activity_at: new Date().toISOString()
    });
}

async function linkUserToConversation(phoneNumber: string, userId: string) {
  await supabase
    .from('whatsapp_conversations')
    .update({ user_id: userId })
    .eq('phone_number', phoneNumber);
}

// ============= USER MANAGEMENT =============

async function findOrCreateUser(phoneNumber: string): Promise<string | null> {
  // Check if user exists with this phone number
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('wa_phone', phoneNumber)
    .single();

  if (profile) {
    return profile.user_id;
  }

  // Create new user via auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    phone: phoneNumber,
    user_metadata: {
      wa_phone: phoneNumber,
      created_via: 'whatsapp'
    }
  });

  if (authError || !authData.user) {
    console.error('Failed to create user:', authError);
    return null;
  }

  return authData.user.id;
}

// ============= BUSINESS LOGIC INTEGRATIONS =============

async function generateQRCode(phoneNumber: string, momoNumber: string, amount?: number): Promise<{ success: boolean; qr_url?: string; ussd?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-qr', {
      body: {
        momo_number: momoNumber,
        amount: amount || null,
        phone_number: phoneNumber
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('QR generation failed:', error);
    return { success: false };
  }
}

async function processVehicleDocument(fileUrl: string, userId: string, usageType: string): Promise<any> {
  try {
    const { data, error } = await supabase.functions.invoke('process-vehicle-ocr', {
      body: {
        file_url: fileUrl,
        user_id: userId,
        usage_type: usageType
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Vehicle OCR failed:', error);
    return { success: false, error: error.message };
  }
}

async function getNearbyDrivers(location: { lat: number; lon: number }, vehicleType: string): Promise<any[]> {
  // Query active drivers near the location
  const { data: drivers } = await supabase
    .from('drivers')
    .select(`
      *,
      profiles!inner(wa_phone, wa_name)
    `)
    .eq('is_active', true)
    .limit(10);

  // In production, you'd calculate actual distances
  // For now, return first 5 drivers with mock distances
  return (drivers || []).slice(0, 5).map((driver, index) => ({
    ...driver,
    distance: `${(index + 1) * 0.5}km`,
    eta: `${(index + 1) * 3}min`
  }));
}

async function downloadWhatsAppMedia(mediaId: string): Promise<string | null> {
  try {
    // Get media URL from WhatsApp
    const mediaResponse = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`
      }
    });

    const mediaData = await mediaResponse.json();
    
    if (!mediaData.url) {
      console.error('No media URL returned:', mediaData);
      return null;
    }

    // Download the actual file
    const fileResponse = await fetch(mediaData.url, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`
      }
    });

    if (!fileResponse.ok) {
      console.error('Failed to download media file');
      return null;
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const fileName = `wa_upload_${Date.now()}_${mediaId}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, fileBuffer, {
        contentType: mediaData.mime_type || 'application/octet-stream'
      });

    if (error) {
      console.error('Failed to upload to storage:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Media download failed:', error);
    return null;
  }
}

// ============= MESSAGE HANDLING =============

async function sendWhatsAppMessage(to: string, message: string, includeMenu: boolean = false): Promise<boolean> {
  try {
    let content = message;
    
    if (includeMenu) {
      content += `\n\n📱 *Main Menu*\n1️⃣ Generate QR Code\n2️⃣ Nearby Drivers\n3️⃣ Schedule Trip\n4️⃣ Add Vehicle\n5️⃣ Motor Insurance\n6️⃣ Help`;
    }

    const response = await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: content }
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      await logWhatsAppMessage(to, 'outbound', content, result.messages?.[0]?.id, 'sent');
      return true;
    } else {
      console.error('WhatsApp API error:', result);
      await logWhatsAppMessage(to, 'outbound', content, undefined, 'failed', { error: result });
      return false;
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

async function sendUSSDLaunch(to: string, ussdCode: string): Promise<boolean> {
  const message = `📱 *Tap to Pay via Mobile Money*\n\n💡 Click the link below to launch USSD payment:\n\n🔗 tel:${ussdCode}\n\n*Or dial manually:* ${ussdCode}\n\nAfter payment, type "paid" to confirm.`;
  
  return await sendWhatsAppMessage(to, message);
}

async function logWhatsAppMessage(phoneNumber: string, direction: 'inbound' | 'outbound', content: string, messageId?: string, status?: string, metadata?: any) {
  try {
    await supabase.from('whatsapp_logs').insert({
      phone_number: phoneNumber,
      direction,
      message_content: content,
      message_id: messageId,
      message_type: 'text',
      status: status || 'received',
      metadata: metadata || {}
    });
  } catch (error) {
    console.error('Error logging WhatsApp message:', error);
  }
}

// ============= CONVERSATION FLOW PROCESSOR =============

async function processConversationFlow(message: WhatsAppMessage): Promise<void> {
  const { from, text, type, image, document, location } = message;
  
  // Get current conversation state
  const state = await getConversationState(from);
  const messageText = text?.body?.toLowerCase().trim() || '';
  
  console.log(`Processing step: ${state.current_step} for ${from}`);
  console.log(`Message: ${messageText}`);
  console.log(`Type: ${type}`);

  // Log incoming message
  await logWhatsAppMessage(from, 'inbound', text?.body || `[${type}]`, message.id);

  // Main conversation flow
  switch (state.current_step) {
    case 'main_menu':
      await handleMainMenu(from, messageText, state);
      break;
      
    // QR CODE GENERATION FLOW
    case 'qr_enter_momo':
      await handleQRMomoEntry(from, messageText, state);
      break;
    case 'qr_choose_amount_mode':
      await handleQRAmountMode(from, messageText, state);
      break;
    case 'qr_enter_custom_amount':
      await handleQRCustomAmount(from, messageText, state);
      break;
      
    // NEARBY DRIVERS FLOW
    case 'drivers_select_vehicle_type':
      await handleDriversVehicleType(from, messageText, state);
      break;
    case 'drivers_share_location':
      if (type === 'location' && location) {
        await handleDriversLocation(from, location, state);
      } else {
        await sendWhatsAppMessage(from, '📍 Please share your location using the location button to find nearby drivers.');
      }
      break;
    case 'drivers_select_driver':
      await handleDriverSelection(from, messageText, state);
      break;
      
    // VEHICLE ADDITION FLOW
    case 'vehicle_select_usage':
      await handleVehicleUsageSelection(from, messageText, state);
      break;
    case 'vehicle_upload_document':
      if (type === 'image' && image) {
        await handleVehicleDocumentUpload(from, image, state);
      } else if (type === 'document' && document) {
        await handleVehicleDocumentUpload(from, document, state);
      } else {
        await sendWhatsAppMessage(from, '📷 Please upload a clear photo of your vehicle insurance certificate or registration document.');
      }
      break;
      
    // SCHEDULE TRIP FLOW
    case 'schedule_select_role':
      await handleScheduleRoleSelection(from, messageText, state);
      break;
    case 'schedule_passenger_vehicle_type':
      await handleSchedulePassengerVehicleType(from, messageText, state);
      break;
    case 'schedule_pickup_location':
      if (type === 'location' && location) {
        await handleSchedulePickupLocation(from, location, state);
      } else {
        await sendWhatsAppMessage(from, '📍 Please share your pickup location using the location button.');
      }
      break;
    case 'schedule_dropoff_location':
      if (type === 'location' && location) {
        await handleScheduleDropoffLocation(from, location, state);
      } else {
        await sendWhatsAppMessage(from, '📍 Please share your drop-off location using the location button.');
      }
      break;
    case 'schedule_datetime':
      await handleScheduleDateTime(from, messageText, state);
      break;
      
    // INSURANCE FLOW
    case 'insurance_check_vehicle':
      await handleInsuranceVehicleCheck(from, messageText, state);
      break;
    case 'insurance_start_date':
      await handleInsuranceStartDate(from, messageText, state);
      break;
    case 'insurance_period':
      await handleInsurancePeriod(from, messageText, state);
      break;
    case 'insurance_addons':
      await handleInsuranceAddons(from, messageText, state);
      break;
      
    default:
      await handleMainMenu(from, messageText, state);
  }
}

// ============= FLOW HANDLERS =============

async function handleMainMenu(from: string, messageText: string, state: ConversationState) {
  if (messageText.includes('hello') || messageText.includes('hi') || messageText === '1' || messageText === 'menu') {
    const welcomeMessage = `🚗 *Welcome to MoveRwanda!* 🇷🇼

Your all-in-one transport and insurance platform.

Choose an option:
1️⃣ Generate QR Code 💳
2️⃣ Nearby Drivers 🚕
3️⃣ Schedule Trip 📅
4️⃣ Add Vehicle 🚗
5️⃣ Motor Insurance 🛡️
6️⃣ Help ℹ️

Reply with a number to continue.`;
    
    await sendWhatsAppMessage(from, welcomeMessage);
    await updateConversationState(from, 'main_menu');
    
  } else if (messageText === '1') {
    await sendWhatsAppMessage(from, `💳 *Generate QR Code for MoMo Payment*\n\nI'll help you create a QR code for mobile money payments.\n\nPlease enter your MoMo number (format: 07XXXXXXXX):`);
    await updateConversationState(from, 'qr_enter_momo');
    
  } else if (messageText === '2') {
    const vehicleTypes = await getVehicleTypes();
    const typesList = vehicleTypes.map((type, index) => `${index + 1}️⃣ ${type.label}`).join('\n');
    
    await sendWhatsAppMessage(from, `🚕 *Find Nearby Drivers*\n\nSelect your preferred vehicle type:\n\n${typesList}\n\nReply with the number of your choice.`);
    await updateConversationState(from, 'drivers_select_vehicle_type', { vehicle_types: vehicleTypes });
    
  } else if (messageText === '3') {
    await sendWhatsAppMessage(from, `📅 *Schedule a Trip*\n\nAre you a:\n1️⃣ Passenger (looking for a ride)\n2️⃣ Driver (offering a ride)\n\nReply with 1 or 2.`);
    await updateConversationState(from, 'schedule_select_role');
    
  } else if (messageText === '4') {
    const usageTypes = [
      { code: 'moto_taxi', label: 'Moto Taxi' },
      { code: 'cab', label: 'Taxi/Cab' },
      { code: 'liffan', label: 'Liffan' },
      { code: 'truck', label: 'Truck' },
      { code: 'rental', label: 'Rental Vehicle' },
      { code: 'personal', label: 'Personal Use' }
    ];
    
    const usageList = usageTypes.map((type, index) => `${index + 1}️⃣ ${type.label}`).join('\n');
    
    await sendWhatsAppMessage(from, `🚗 *Add Your Vehicle*\n\nSelect your vehicle usage type:\n\n${usageList}\n\nReply with the number of your choice.`);
    await updateConversationState(from, 'vehicle_select_usage', { usage_types: usageTypes });
    
  } else if (messageText === '5') {
    await sendWhatsAppMessage(from, `🛡️ *Motor Insurance*\n\nGet affordable motor insurance for your vehicle.\n\nDo you already have a vehicle registered with us?\n1️⃣ Yes, I have a vehicle\n2️⃣ No, I need to add my vehicle first\n\nReply with 1 or 2.`);
    await updateConversationState(from, 'insurance_check_vehicle');
    
  } else if (messageText === '6' || messageText.includes('help')) {
    const helpMessage = `ℹ️ *MoveRwanda Help*\n\nAvailable services:\n🔸 QR Code generation for MoMo payments\n🔸 Find nearby drivers for instant rides\n🔸 Schedule future trips\n🔸 Vehicle registration with OCR\n🔸 Motor insurance quotes and policies\n\nType "menu" to return to main menu.\n\nFor technical support: support@moverwanda.com`;
    
    await sendWhatsAppMessage(from, helpMessage, true);
    
  } else {
    await sendWhatsAppMessage(from, `I didn't understand "${messageText}". Please choose from the menu options.`, true);
  }
}

async function handleQRMomoEntry(from: string, messageText: string, state: ConversationState) {
  const momoPattern = /^07\d{8}$/;
  
  if (momoPattern.test(messageText)) {
    await sendWhatsAppMessage(from, `✅ MoMo number saved: ${messageText}\n\nChoose amount option:\n1️⃣ With specific amount\n2️⃣ No amount (let payer decide)\n\nReply with 1 or 2.`);
    await updateConversationState(from, 'qr_choose_amount_mode', { momo_number: messageText });
  } else {
    await sendWhatsAppMessage(from, `❌ Invalid format. Please enter a valid MoMo number starting with 07 followed by 8 digits.\n\nExample: 0712345678`);
  }
}

async function handleQRAmountMode(from: string, messageText: string, state: ConversationState) {
  if (messageText === '1') {
    await sendWhatsAppMessage(from, `💰 *Set Amount*\n\nQuick amounts:\n1️⃣ 1,000 RWF\n2️⃣ 2,000 RWF\n3️⃣ 5,000 RWF\n4️⃣ 10,000 RWF\n5️⃣ Custom amount\n\nReply with your choice:`);
    await updateConversationState(from, 'qr_enter_custom_amount', state.conversation_data);
  } else if (messageText === '2') {
    await generateAndSendQR(from, state.conversation_data.momo_number, null);
  } else {
    await sendWhatsAppMessage(from, `Please reply with 1 for "With amount" or 2 for "No amount".`);
  }
}

async function handleQRCustomAmount(from: string, messageText: string, state: ConversationState) {
  let amount = null;
  
  if (messageText === '1') amount = 1000;
  else if (messageText === '2') amount = 2000;
  else if (messageText === '3') amount = 5000;
  else if (messageText === '4') amount = 10000;
  else if (messageText === '5') {
    await sendWhatsAppMessage(from, `💰 Enter your custom amount in RWF (numbers only):\n\nExample: 15000`);
    await updateConversationState(from, 'qr_custom_amount_entry', state.conversation_data);
    return;
  } else if (/^\d+$/.test(messageText)) {
    amount = parseInt(messageText);
  } else {
    await sendWhatsAppMessage(from, `❌ Invalid amount. Please enter a number or choose from the quick options.`);
    return;
  }
  
  await generateAndSendQR(from, state.conversation_data.momo_number, amount);
}

async function generateAndSendQR(from: string, momoNumber: string, amount: number | null) {
  await sendWhatsAppMessage(from, `⏳ Generating your QR code...`);
  
  const result = await generateQRCode(from, momoNumber, amount);
  
  if (result.success && result.qr_url) {
    const amountText = amount ? `*Amount:* ${amount.toLocaleString()} RWF\n` : `*Amount:* Open (payer decides)\n`;
    
    await sendWhatsAppMessage(from, `✅ *QR Code Generated Successfully!*\n\n*MoMo Number:* ${momoNumber}\n${amountText}\n📱 QR Image: ${result.qr_url}\n\n${result.ussd ? `💡 *Quick USSD:* ${result.ussd}` : ''}\n\nTap the link above to launch mobile money payment directly!`);
    
    if (result.ussd) {
      await sendUSSDLaunch(from, result.ussd);
    }
  } else {
    await sendWhatsAppMessage(from, `❌ Failed to generate QR code. Please try again or contact support.`);
  }
  
  await sendWhatsAppMessage(from, `Would you like to:\n1️⃣ Generate another QR\n2️⃣ Return to main menu\n\nReply with 1 or 2.`);
  await updateConversationState(from, 'qr_post_generation');
}

async function handleDriversVehicleType(from: string, messageText: string, state: ConversationState) {
  const vehicleTypes = state.conversation_data.vehicle_types;
  const choice = parseInt(messageText) - 1;
  
  if (choice >= 0 && choice < vehicleTypes.length) {
    const selectedType = vehicleTypes[choice];
    
    await sendWhatsAppMessage(from, `🚕 Selected: ${selectedType.label}\n\n📍 Please share your current location using the location button below so I can find nearby drivers.`);
    await updateConversationState(from, 'drivers_share_location', { 
      ...state.conversation_data, 
      selected_vehicle_type: selectedType 
    });
  } else {
    await sendWhatsAppMessage(from, `❌ Invalid choice. Please select a number from the list.`);
  }
}

async function handleDriversLocation(from: string, location: any, state: ConversationState) {
  await sendWhatsAppMessage(from, `📍 Location received! Searching for nearby ${state.conversation_data.selected_vehicle_type.label} drivers...`);
  
  const drivers = await getNearbyDrivers(
    { lat: location.latitude, lon: location.longitude },
    state.conversation_data.selected_vehicle_type.code
  );
  
  if (drivers.length === 0) {
    await sendWhatsAppMessage(from, `😞 No ${state.conversation_data.selected_vehicle_type.label} drivers found nearby at the moment.\n\nTry:\n1️⃣ Different vehicle type\n2️⃣ Check again in a few minutes\n3️⃣ Return to main menu\n\nReply with your choice:`);
    return;
  }
  
  const driversList = drivers.map((driver, index) => 
    `${index + 1}️⃣ ${driver.profiles.wa_name || 'Driver'} - ${driver.distance} away (${driver.eta})`
  ).join('\n');
  
  await sendWhatsAppMessage(from, `🚕 *Found ${drivers.length} nearby drivers:*\n\n${driversList}\n\n📞 Select a driver to book or chat:\nReply with the number (1-${drivers.length})`);
  await updateConversationState(from, 'drivers_select_driver', {
    ...state.conversation_data,
    drivers: drivers,
    user_location: location
  });
}

async function handleDriverSelection(from: string, messageText: string, state: ConversationState) {
  const drivers = state.conversation_data.drivers;
  const choice = parseInt(messageText) - 1;
  
  if (choice >= 0 && choice < drivers.length) {
    const selectedDriver = drivers[choice];
    
    await sendWhatsAppMessage(from, `🚕 *Selected Driver: ${selectedDriver.profiles.wa_name || 'Driver'}*\n\nDistance: ${selectedDriver.distance}\nETA: ${selectedDriver.eta}\nRating: ⭐ ${selectedDriver.rating || 'New'}\n\nWhat would you like to do?\n1️⃣ Book this driver\n2️⃣ Chat with driver\n3️⃣ Choose another driver\n\nReply with 1, 2, or 3:`);
    await updateConversationState(from, 'drivers_confirm_booking', {
      ...state.conversation_data,
      selected_driver: selectedDriver
    });
  } else {
    await sendWhatsAppMessage(from, `❌ Invalid choice. Please select a number from 1 to ${drivers.length}.`);
  }
}

async function handleVehicleUsageSelection(from: string, messageText: string, state: ConversationState) {
  const usageTypes = state.conversation_data.usage_types;
  const choice = parseInt(messageText) - 1;
  
  if (choice >= 0 && choice < usageTypes.length) {
    const selectedUsage = usageTypes[choice];
    
    await sendWhatsAppMessage(from, `🚗 Selected: ${selectedUsage.label}\n\n📋 Now please upload a clear photo of your vehicle's insurance certificate or registration document.\n\n📷 The photo should show:\n• Vehicle plate number\n• Owner name\n• Insurance details\n• Expiry date\n\nSend the photo when ready.`);
    await updateConversationState(from, 'vehicle_upload_document', {
      ...state.conversation_data,
      selected_usage: selectedUsage
    });
  } else {
    await sendWhatsAppMessage(from, `❌ Invalid choice. Please select a number from the list.`);
  }
}

async function handleVehicleDocumentUpload(from: string, media: any, state: ConversationState) {
  await sendWhatsAppMessage(from, `📄 Document received! Processing with AI OCR...\n\n⏳ This may take a few moments while I extract your vehicle information.`);
  
  // Download the media file
  const fileUrl = await downloadWhatsAppMedia(media.id);
  
  if (!fileUrl) {
    await sendWhatsAppMessage(from, `❌ Failed to download your document. Please try uploading again.`);
    return;
  }
  
  // Get or create user
  const userId = await findOrCreateUser(from);
  if (!userId) {
    await sendWhatsAppMessage(from, `❌ System error. Please try again later.`);
    return;
  }
  
  await linkUserToConversation(from, userId);
  
  // Process with OCR
  const result = await processVehicleDocument(
    fileUrl, 
    userId, 
    state.conversation_data.selected_usage.code
  );
  
  if (result.success) {
    const vehicleData = result.data.extracted_data;
    const summary = `✅ *Vehicle Successfully Added!*\n\n📋 *Extracted Information:*\n• Plate: ${vehicleData.plate || 'N/A'}\n• Make: ${vehicleData.make || 'N/A'}\n• Model: ${vehicleData.model || 'N/A'}\n• Year: ${vehicleData.year || 'N/A'}\n• Owner: ${vehicleData.owner || 'N/A'}\n• Insurance: ${vehicleData.insurance_provider || 'N/A'}\n\n${result.data.driver ? '🚗 Driver profile activated! You can now receive ride requests.' : ''}`;
    
    await sendWhatsAppMessage(from, summary, true);
  } else {
    await sendWhatsAppMessage(from, `❌ *OCR Processing Failed*\n\n${result.error || 'Unable to extract vehicle information from the document.'}\n\nPlease ensure:\n• Image is clear and well-lit\n• Document contains vehicle information\n• Text is readable\n\nTry uploading again or contact support.`);
  }
  
  await updateConversationState(from, 'main_menu');
}

// ============= ADDITIONAL FLOW HANDLERS =============

async function handleScheduleRoleSelection(from: string, messageText: string, state: ConversationState) {
  if (messageText === '1') {
    const vehicleTypes = await getVehicleTypes();
    const typesList = vehicleTypes.map((type, index) => `${index + 1}️⃣ ${type.label}`).join('\n');
    
    await sendWhatsAppMessage(from, `🚕 *Schedule Trip as Passenger*\n\nSelect vehicle type:\n\n${typesList}\n\nReply with your choice:`);
    await updateConversationState(from, 'schedule_passenger_vehicle_type', { 
      role: 'passenger',
      vehicle_types: vehicleTypes 
    });
  } else if (messageText === '2') {
    await sendWhatsAppMessage(from, `🚗 *Schedule Trip as Driver*\n\n📍 Share your starting location using the location button to set your route.`);
    await updateConversationState(from, 'schedule_driver_start_location', { role: 'driver' });
  } else {
    await sendWhatsAppMessage(from, `Please reply with 1 for Passenger or 2 for Driver.`);
  }
}

async function handleSchedulePassengerVehicleType(from: string, messageText: string, state: ConversationState) {
  const vehicleTypes = state.conversation_data.vehicle_types;
  const choice = parseInt(messageText) - 1;
  
  if (choice >= 0 && choice < vehicleTypes.length) {
    const selectedType = vehicleTypes[choice];
    
    await sendWhatsAppMessage(from, `🚕 Selected: ${selectedType.label}\n\n📍 Please share your pickup location using the location button.`);
    await updateConversationState(from, 'schedule_pickup_location', {
      ...state.conversation_data,
      selected_vehicle_type: selectedType
    });
  } else {
    await sendWhatsAppMessage(from, `❌ Invalid choice. Please select a number from the list.`);
  }
}

async function handleSchedulePickupLocation(from: string, location: any, state: ConversationState) {
  await sendWhatsAppMessage(from, `📍 Pickup location set!\n\n📍 Now please share your drop-off location using the location button.`);
  await updateConversationState(from, 'schedule_dropoff_location', {
    ...state.conversation_data,
    pickup_location: location
  });
}

async function handleScheduleDropoffLocation(from: string, location: any, state: ConversationState) {
  await sendWhatsAppMessage(from, `📍 Drop-off location set!\n\n🕐 When would you like to travel?\n\n1️⃣ Today\n2️⃣ Tomorrow\n3️⃣ Pick specific date\n4️⃣ ASAP\n\nReply with your choice:`);
  await updateConversationState(from, 'schedule_datetime', {
    ...state.conversation_data,
    dropoff_location: location
  });
}

async function handleScheduleDateTime(from: string, messageText: string, state: ConversationState) {
  let scheduledFor = new Date();
  
  if (messageText === '1') {
    // Today - ask for time
    await sendWhatsAppMessage(from, `🕐 What time today? (format: HH:MM)\n\nExample: 14:30`);
    await updateConversationState(from, 'schedule_time_entry', {
      ...state.conversation_data,
      date_choice: 'today'
    });
    return;
  } else if (messageText === '2') {
    // Tomorrow
    scheduledFor.setDate(scheduledFor.getDate() + 1);
    await sendWhatsAppMessage(from, `🕐 What time tomorrow? (format: HH:MM)\n\nExample: 09:00`);
    await updateConversationState(from, 'schedule_time_entry', {
      ...state.conversation_data,
      date_choice: 'tomorrow'
    });
    return;
  } else if (messageText === '3') {
    await sendWhatsAppMessage(from, `📅 Enter date (format: DD/MM/YYYY)\n\nExample: 25/12/2024`);
    await updateConversationState(from, 'schedule_date_entry', state.conversation_data);
    return;
  } else if (messageText === '4') {
    // ASAP
    scheduledFor = new Date();
  } else {
    await sendWhatsAppMessage(from, `Please choose 1-4 from the options.`);
    return;
  }
  
  await createScheduledRide(from, state.conversation_data, scheduledFor);
}

async function createScheduledRide(from: string, conversationData: any, scheduledFor: Date) {
  // Get or create user
  const userId = await findOrCreateUser(from);
  if (!userId) {
    await sendWhatsAppMessage(from, `❌ System error. Please try again later.`);
    return;
  }
  
  // Create ride record
  const { data: ride, error } = await supabase
    .from('rides')
    .insert({
      passenger_user_id: userId,
      pickup: conversationData.pickup_location,
      dropoff: conversationData.dropoff_location,
      scheduled_for: scheduledFor.toISOString(),
      status: 'pending',
      meta: {
        vehicle_type: conversationData.selected_vehicle_type?.code,
        created_via: 'whatsapp',
        phone_number: from
      }
    })
    .select()
    .single();
  
  if (error) {
    console.error('Failed to create ride:', error);
    await sendWhatsAppMessage(from, `❌ Failed to schedule ride. Please try again.`);
    return;
  }
  
  await sendWhatsAppMessage(from, `✅ *Trip Scheduled Successfully!*\n\n🚕 Vehicle: ${conversationData.selected_vehicle_type?.label}\n📍 Pickup: ${conversationData.pickup_location?.name || 'Location set'}\n📍 Drop-off: ${conversationData.dropoff_location?.name || 'Location set'}\n🕐 Time: ${scheduledFor.toLocaleString()}\n\n📱 Trip ID: ${ride.id.slice(0, 8)}\n\nYou'll receive notifications when drivers respond to your request.`, true);
  
  await updateConversationState(from, 'main_menu');
}

async function handleInsuranceVehicleCheck(from: string, messageText: string, state: ConversationState) {
  if (messageText === '1') {
    // Check if user has vehicles
    const userId = await findOrCreateUser(from);
    if (!userId) {
      await sendWhatsAppMessage(from, `❌ System error. Please try again later.`);
      return;
    }
    
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId);
    
    if (!vehicles || vehicles.length === 0) {
      await sendWhatsAppMessage(from, `🚗 No vehicles found in your account.\n\nPlease add a vehicle first by going to:\n4️⃣ Add Vehicle\n\nOr continue without a registered vehicle.`, true);
      return;
    }
    
    const vehiclesList = vehicles.map((vehicle, index) => 
      `${index + 1}️⃣ ${vehicle.plate || 'Unknown'} - ${vehicle.make} ${vehicle.model}`
    ).join('\n');
    
    await sendWhatsAppMessage(from, `🚗 *Select Vehicle for Insurance:*\n\n${vehiclesList}\n\nReply with the number of your choice:`);
    await updateConversationState(from, 'insurance_select_vehicle', {
      vehicles: vehicles,
      user_id: userId
    });
    
  } else if (messageText === '2') {
    await sendWhatsAppMessage(from, `🚗 You'll need to add your vehicle first.\n\nRedirecting to vehicle addition...`);
    await updateConversationState(from, 'main_menu');
    // Trigger vehicle addition flow
    const usageTypes = [
      { code: 'moto_taxi', label: 'Moto Taxi' },
      { code: 'cab', label: 'Taxi/Cab' },
      { code: 'personal', label: 'Personal Use' }
    ];
    
    const usageList = usageTypes.map((type, index) => `${index + 1}️⃣ ${type.label}`).join('\n');
    
    await sendWhatsAppMessage(from, `🚗 *Add Your Vehicle*\n\nSelect your vehicle usage type:\n\n${usageList}\n\nReply with the number of your choice.`);
    await updateConversationState(from, 'vehicle_select_usage', { usage_types: usageTypes });
    
  } else {
    await sendWhatsAppMessage(from, `Please reply with 1 if you have a vehicle or 2 if you need to add one.`);
  }
}

async function handleInsuranceStartDate(from: string, messageText: string, state: ConversationState) {
  let startDate = new Date();
  
  if (messageText === '1') {
    // Start today
    startDate = new Date();
  } else if (messageText === '2') {
    await sendWhatsAppMessage(from, `📅 Enter start date (format: DD/MM/YYYY)\n\nExample: 01/01/2025`);
    await updateConversationState(from, 'insurance_custom_start_date', state.conversation_data);
    return;
  } else {
    await sendWhatsAppMessage(from, `Please reply with 1 for today or 2 to pick another date.`);
    return;
  }
  
  // Get insurance periods
  const { data: periods } = await supabase.from('insurance_periods').select('*');
  const periodsList = (periods || []).map((period, index) => 
    `${index + 1}️⃣ ${period.label} (${period.months} months)`
  ).join('\n');
  
  await sendWhatsAppMessage(from, `📋 *Select Insurance Period:*\n\n${periodsList}\n\nReply with your choice:`);
  await updateConversationState(from, 'insurance_period', {
    ...state.conversation_data,
    start_date: startDate.toISOString(),
    insurance_periods: periods
  });
}

async function handleInsurancePeriod(from: string, messageText: string, state: ConversationState) {
  const periods = state.conversation_data.insurance_periods;
  const choice = parseInt(messageText) - 1;
  
  if (choice >= 0 && choice < periods.length) {
    const selectedPeriod = periods[choice];
    
    // Get available addons
    const { data: addons } = await supabase.from('insurance_addons').select('*').eq('is_active', true);
    
    if (addons && addons.length > 0) {
      const addonsList = addons.map((addon, index) => 
        `${index + 1}️⃣ ${addon.name} (+${addon.price} RWF)`
      ).join('\n');
      
      await sendWhatsAppMessage(from, `✅ Selected: ${selectedPeriod.label}\n\n🛡️ *Optional Add-ons:*\n\n${addonsList}\n\n0️⃣ No add-ons (continue)\n\nSelect add-ons by replying with numbers (e.g., "1,3" for multiple) or 0 to continue:`);
      await updateConversationState(from, 'insurance_addons', {
        ...state.conversation_data,
        selected_period: selectedPeriod,
        available_addons: addons
      });
    } else {
      await generateInsuranceQuote(from, state.conversation_data, selectedPeriod, []);
    }
  } else {
    await sendWhatsAppMessage(from, `❌ Invalid choice. Please select a number from the list.`);
  }
}

async function handleInsuranceAddons(from: string, messageText: string, state: ConversationState) {
  const addons = state.conversation_data.available_addons;
  let selectedAddons: any[] = [];
  
  if (messageText !== '0') {
    const choices = messageText.split(',').map(s => parseInt(s.trim()) - 1);
    selectedAddons = choices
      .filter(choice => choice >= 0 && choice < addons.length)
      .map(choice => addons[choice]);
  }
  
  await generateInsuranceQuote(from, state.conversation_data, state.conversation_data.selected_period, selectedAddons);
}

async function generateInsuranceQuote(from: string, conversationData: any, period: any, selectedAddons: any[]) {
  const userId = conversationData.user_id;
  const vehicleId = conversationData.selected_vehicle?.id;
  
  // Calculate total premium
  const basePremium = 50000; // Base premium in RWF
  const periodMultiplier = period.multiplier || 1;
  const addonsCost = selectedAddons.reduce((sum, addon) => sum + (addon.price || 0), 0);
  const totalPremium = (basePremium * periodMultiplier) + addonsCost;
  
  // Create quote record
  const quoteData = {
    base_premium: basePremium,
    period: period.label,
    period_months: period.months,
    selected_addons: selectedAddons.map(addon => addon.name),
    total_premium: totalPremium,
    currency: 'RWF',
    created_via: 'whatsapp'
  };
  
  const { data: quote, error } = await supabase
    .from('insurance_quotes')
    .insert({
      user_id: userId,
      vehicle_id: vehicleId,
      quote_data: quoteData,
      status: 'pending',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    })
    .select()
    .single();
  
  if (error) {
    console.error('Failed to create quote:', error);
    await sendWhatsAppMessage(from, `❌ Failed to generate quote. Please try again.`);
    return;
  }
  
  const addonsText = selectedAddons.length > 0 
    ? `\n🛡️ *Add-ons:*\n${selectedAddons.map(addon => `• ${addon.name}`).join('\n')}`
    : '';
  
  await sendWhatsAppMessage(from, `💼 *Insurance Quote Generated!*\n\n📋 *Summary:*\n• Period: ${period.label}\n• Base Premium: ${basePremium.toLocaleString()} RWF\n• Period Cost: ${(basePremium * periodMultiplier).toLocaleString()} RWF${addonsText}\n\n💰 *Total Premium: ${totalPremium.toLocaleString()} RWF*\n\n⏰ Quote valid for 24 hours\n📱 Quote ID: ${quote.id.slice(0, 8)}\n\nWhat would you like to do?\n1️⃣ Proceed with payment\n2️⃣ Modify quote\n3️⃣ Save for later\n\nReply with your choice:`);
  
  await updateConversationState(from, 'insurance_quote_action', {
    ...conversationData,
    quote: quote,
    total_premium: totalPremium
  });
}

async function getVehicleTypes(): Promise<any[]> {
  const { data } = await supabase.from('vehicle_types').select('*');
  return data || [
    { code: 'moto', label: 'Motorcycle' },
    { code: 'car', label: 'Car' },
    { code: 'suv', label: 'SUV' },
    { code: 'truck', label: 'Truck' }
  ];
}

// ============= WEBHOOK HANDLER =============

Deno.serve(async (req) => {
  console.log(`${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('Webhook verification request:', { mode, token, challenge });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verified successfully');
      return new Response(challenge, { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    } else {
      console.log('❌ Webhook verification failed');
      return new Response('Forbidden', { status: 403 });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('📨 Incoming webhook:', JSON.stringify(body, null, 2));

      if (body.entry && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              if (change.value.messages && Array.isArray(change.value.messages)) {
                for (const message of change.value.messages) {
                  console.log(`🔄 Processing message from ${message.from}`);
                  await processConversationFlow(message);
                }
              }
              
              if (change.value.statuses && Array.isArray(change.value.statuses)) {
                for (const status of change.value.statuses) {
                  console.log('📊 Message status update:', status);
                }
              }
            }
          }
        }
      }

      return new Response('OK', { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }
  }

  return new Response('Method Not Allowed', { 
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
  });
});