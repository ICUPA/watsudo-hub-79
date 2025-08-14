import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VERIFY_TOKEN = 'bd0e7b6f4a2c9d83f1e57a0c6b3d48e9';
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
const WHATSAPP_APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET');

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
  step: 'main_menu' | 'qr_entry' | 'qr_momo_setup' | 'qr_amount' | 'qr_amount_pick' | 'qr_amount_custom' | 'qr_generating' | 
        'qr_scan' | 'qr_decode' | 'nearby_drivers' | 'nd_vehicle_type' | 'nd_location' | 'nd_driver_list' | 'nd_driver_detail' | 'nd_booking' |
        'schedule_trip' | 'st_role' | 'st_passenger_vehicle' | 'st_passenger_pickup' | 'st_passenger_dropoff' | 'st_passenger_datetime' | 'st_passenger_drivers' |
        'st_driver_route' | 'st_driver_time' | 'add_vehicle' | 'av_usage_type' | 'av_insurance_upload' | 'av_processing' | 'av_success' |
        'insurance' | 'ins_vehicle_check' | 'ins_start_date' | 'ins_period' | 'ins_addons' | 'ins_pa_category' | 'ins_summary' | 
        'ins_quotation_pending' | 'ins_quotation_received' | 'ins_payment_plan' | 'ins_payment_pending' | 'ins_certificate' |
        'ins_period_confirm' | 'ins_custom_date' | 'ins_custom_end_date';
  
  // QR Code data
  userMomo?: string;
  qrAmount?: number;
  
  // Driver/Ride data
  selectedVehicleType?: string;
  userLocation?: string;
  nearbyDrivers?: any[];
  selectedDriver?: any;
  rideData?: any;
  
  // Vehicle registration
  extractedData?: any;
  ownerPhone?: string;
  usageType?: string;
  
  // Schedule trip
  tripRole?: 'passenger' | 'driver';
  pickupLocation?: string;
  dropoffLocation?: string;
  scheduledTime?: string;
  
  // Insurance flow
  hasVehicleOnFile?: boolean;
  insuranceStartDate?: string;
  selectedPeriod?: string;
  selectedAddons?: number[];
  selectedPACategory?: string;
  insuranceQuoteId?: string;
  
  // User linking
  user_id?: string;
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
      step: 'main_menu'
    };
    
    const { data: createdState } = await supabase
      .from('whatsapp_conversations')
      .insert({
        phone_number: phoneNumber,
        current_step: 'main_menu',
        conversation_data: newState
      })
      .select()
      .single();
    
    return createdState?.conversation_data || newState;
  }

  return data.conversation_data;
}

async function updateConversationState(phoneNumber: string, newState: ConversationState) {
  await supabase
    .from('whatsapp_conversations')
    .upsert({
      phone_number: phoneNumber,
      user_id: newState.user_id,
      current_step: newState.step,
      conversation_data: newState,
      last_activity_at: new Date().toISOString()
    });
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

async function getNearbyDrivers(location: string, vehicleType: string): Promise<any[]> {
  // Query active drivers near the location
  const { data: drivers } = await supabase
    .from('drivers')
    .select(`
      *,
      profiles!inner(wa_phone, wa_name)
    `)
    .eq('is_active', true)
    .limit(10);

  // Mock drivers with distances and ratings
  return (drivers || []).slice(0, 5).map((driver, index) => ({
    ...driver,
    plate: `RAB ${100 + index}A`,
    distance: `${(index + 1) * 0.5}`,
    rating: `${4.0 + (index * 0.2)}`,
    eta: `${(index + 1) * 3} min`
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

async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  try {
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
        text: { body: message }
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      await logWhatsAppMessage(to, 'outbound', message, result.messages?.[0]?.id, 'sent');
      return true;
    } else {
      console.error('WhatsApp API error:', result);
      await logWhatsAppMessage(to, 'outbound', message, undefined, 'failed', { error: result });
      return false;
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
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

// ============= CONVERSATION FLOW PROCESSOR (Following Admin Simulator Pattern) =============

async function processConversationFlow(message: WhatsAppMessage): Promise<void> {
  const { from, text, type, image, document, location } = message;
  const content = text?.body?.toLowerCase().trim() || '';
  
  // Get current conversation state
  let conversationState = await getConversationState(from);
  
  console.log(`Processing step: ${conversationState.step} for ${from}`);
  console.log(`Message: ${content}`);
  
  // Log incoming message
  await logWhatsAppMessage(from, 'inbound', text?.body || `[${type}]`, message.id);

  let botResponse = "";
  let newState = { ...conversationState };

  // Follow exact same flow as WhatsAppSimulator
  switch (conversationState.step) {
    case 'main_menu':
      if (content === '1' || content.includes('qr') || content.includes('generate')) {
        botResponse = "💳 **Generate QR Code**\n\nChecking your MoMo details...";
        newState.step = 'qr_entry';
        
        await sendWhatsAppMessage(from, botResponse);
        
        // Check for saved MoMo
        const { data: profile } = await supabase
          .from('profiles')
          .select('default_momo_phone')
          .eq('wa_phone', from)
          .single();
        
        if (profile?.default_momo_phone) {
          newState.userMomo = profile.default_momo_phone;
          const chooseAmountMsg = `💳 MoMo found: ${profile.default_momo_phone}\n\nChoose amount mode:\n1️⃣ With amount\n2️⃣ No amount (recipient chooses)`;
          await sendWhatsAppMessage(from, chooseAmountMsg);
          newState.step = 'qr_amount';
        } else {
          const enterMomoMsg = "📱 **Enter your MoMo number**\n\nFormat: 07XXXXXXXX";
          await sendWhatsAppMessage(from, enterMomoMsg);
          newState.step = 'qr_momo_setup';
        }
        
        await updateConversationState(from, newState);
        return;
      }
      else if (content === '2' || content.includes('nearby') || content.includes('driver')) {
        const vehicleTypes = ["Motorcycle", "Car", "SUV", "Truck"];
        botResponse = `🚗 **Nearby Drivers**\n\nChoose vehicle type:\n${vehicleTypes.map((type, i) => `${i + 1}️⃣ ${type}`).join('\n')}`;
        newState.step = 'nd_vehicle_type';
      }
      else if (content === '3' || content.includes('schedule')) {
        botResponse = "📅 **Schedule Trip**\n\nChoose your role:\n1️⃣ Passenger\n2️⃣ Driver";
        newState.step = 'st_role';
      }
      else if (content === '4' || content.includes('add') || content.includes('vehicle')) {
        const types = ["Moto Taxi", "Cab", "Liffan", "Truck", "Rental", "Other"];
        botResponse = `🚗 **Add Vehicle**\n\nChoose usage type:\n${types.map((type, i) => `${i + 1}️⃣ ${type}`).join('\n')}`;
        newState.step = 'av_usage_type';
      }
      else if (content === '5' || content.includes('insurance') || content.includes('motor')) {
        botResponse = "🛡️ **Insurance for Moto**\n\nChecking your vehicle records...";
        newState.step = 'insurance';
        
        await sendWhatsAppMessage(from, botResponse);
        
        // Check for vehicles
        const userId = await findOrCreateUser(from);
        if (userId) {
          newState.user_id = userId;
          const { data: vehicles } = await supabase
            .from('vehicles')
            .select('*')
            .eq('user_id', userId);
          
          const hasVehicle = vehicles && vehicles.length > 0;
          newState.hasVehicleOnFile = hasVehicle;
          
          if (hasVehicle) {
            const vehicleMsg = `✅ **Vehicle Found: ${vehicles[0].plate}**\n\nProceed with insurance quote?\n\n1️⃣ Continue\n2️⃣ Back to menu`;
            await sendWhatsAppMessage(from, vehicleMsg);
            newState.step = 'ins_vehicle_check';
          } else {
            const docsMsg = "📄 **Documents Required**\n\nPlease upload:\n• Carte Jaune (Vehicle Registration)\n• Old Insurance Certificate\n\n📎 Upload documents or type 'agent' to chat with support.";
            await sendWhatsAppMessage(from, docsMsg);
            newState.step = 'ins_vehicle_check';
          }
        }
        
        await updateConversationState(from, newState);
        return;
      }
      else if (content === '6' || content.includes('more')) {
        botResponse = "📋 **More Features**\n\n1️⃣ Scan QR Code\n2️⃣ Payment History\n3️⃣ Support\n4️⃣ Settings\n\nSelect option or type 'menu' to return.";
      }
      else if (content.includes('menu') || content.includes('back')) {
        botResponse = "🚗 **Welcome to MoveRwanda!**\n\nChoose an option:\n1️⃣ Generate QR Code\n2️⃣ Nearby Drivers\n3️⃣ Schedule Trip\n4️⃣ Add Vehicle\n5️⃣ Get Motor Insurance\n6️⃣ More\n\nReply with number (1-6) or option name.";
      }
      else {
        botResponse = "🚗 **Welcome to MoveRwanda!**\n\nChoose an option:\n1️⃣ Generate QR Code\n2️⃣ Nearby Drivers\n3️⃣ Schedule Trip\n4️⃣ Add Vehicle\n5️⃣ Get Motor Insurance\n6️⃣ More\n\nReply with number (1-6) or option name.";
      }
      break;

    case 'qr_momo_setup':
      if (content.match(/^07\d{8}$/)) {
        // Save MoMo number
        const userId = await findOrCreateUser(from);
        if (userId) {
          await supabase
            .from('profiles')
            .update({ default_momo_phone: content })
            .eq('user_id', userId);
        }
        
        newState.userMomo = content;
        botResponse = `✅ MoMo saved: ${content}\n\nChoose amount mode:\n1️⃣ With amount\n2️⃣ No amount (recipient chooses)`;
        newState.step = 'qr_amount';
      } else {
        botResponse = "❌ Invalid format. Please enter MoMo as: 07XXXXXXXX";
      }
      break;

    case 'qr_amount':
      if (content === '1') {
        botResponse = "💰 **Set Amount**\n\nQuick pick:\n1️⃣ 1,000 RWF\n2️⃣ 2,000 RWF\n3️⃣ 5,000 RWF\n4️⃣ Other amount";
        newState.step = 'qr_amount_pick';
      } else if (content === '2') {
        newState.qrAmount = undefined;
        botResponse = "🔄 Generating QR code...";
        newState.step = 'qr_generating';
        
        await sendWhatsAppMessage(from, botResponse);
        
        const result = await generateQRCode(from, newState.userMomo!);
        if (result.success) {
          const ussdCode = `*182*1*1*${newState.userMomo!.replace(/^0/, '')}#`;
          const qrMsg = `✅ **QR Code Generated!**\n\n💳 MoMo: ${newState.userMomo}\n💰 Amount: Recipient chooses\n📱 USSD: ${ussdCode}\n\n**Actions:**\n• Generate another\n• Home`;
          await sendWhatsAppMessage(from, qrMsg);
        }
        
        newState.step = 'main_menu';
        await updateConversationState(from, newState);
        return;
      } else {
        botResponse = "Please choose an option:\n1️⃣ With amount\n2️⃣ No amount";
      }
      break;

    case 'qr_amount_pick':
      let amount = 0;
      if (content === '1' || content === '1000') amount = 1000;
      else if (content === '2' || content === '2000') amount = 2000;
      else if (content === '3' || content === '5000') amount = 5000;
      else if (content === '4') {
        botResponse = "💰 Enter custom amount (digits only, e.g., 3500):";
        newState.step = 'qr_amount_custom';
        break;
      } else {
        botResponse = "Please choose an option (1-4) or enter amount directly.";
        break;
      }
      
      newState.qrAmount = amount;
      botResponse = "🔄 Generating QR code...";
      
      await sendWhatsAppMessage(from, botResponse);
      
      const result = await generateQRCode(from, newState.userMomo!, amount);
      if (result.success) {
        const ussdCode = `*182*1*1*${newState.userMomo!.replace(/^0/, '')}*${amount}#`;
        const qrMsg = `✅ **QR Code Generated!**\n\n💳 MoMo: ${newState.userMomo}\n💰 Amount: ${amount.toLocaleString()} RWF\n📱 USSD: ${ussdCode}\n\n**Actions:**\n• Generate another\n• Home`;
        await sendWhatsAppMessage(from, qrMsg);
      }
      
      newState.step = 'main_menu';
      await updateConversationState(from, newState);
      return;

    case 'qr_amount_custom':
      if (content.match(/^\d+$/) && parseInt(content) > 0) {
        const customAmount = parseInt(content);
        newState.qrAmount = customAmount;
        botResponse = "🔄 Generating QR code...";
        
        await sendWhatsAppMessage(from, botResponse);
        
        const result = await generateQRCode(from, newState.userMomo!, customAmount);
        if (result.success) {
          const ussdCode = `*182*1*1*${newState.userMomo!.replace(/^0/, '')}*${customAmount}#`;
          const qrMsg = `✅ **QR Code Generated!**\n\n💳 MoMo: ${newState.userMomo}\n💰 Amount: ${customAmount.toLocaleString()} RWF\n📱 USSD: ${ussdCode}\n\n**Actions:**\n• Generate another\n• Home`;
          await sendWhatsAppMessage(from, qrMsg);
        }
        
        newState.step = 'main_menu';
        await updateConversationState(from, newState);
        return;
      } else {
        botResponse = "❌ Please enter a valid amount (digits only, greater than 0).";
      }
      break;

    case 'nd_vehicle_type':
      const vehicleTypes = ["Motorcycle", "Car", "SUV", "Truck"];
      const selectedIndex = parseInt(content) - 1;
      if (selectedIndex >= 0 && selectedIndex < vehicleTypes.length) {
        newState.selectedVehicleType = vehicleTypes[selectedIndex];
        botResponse = "📍 **Share Your Location**\n\nPlease share your current location to find nearby drivers.\n\n(In real WhatsApp, tap attachment → Location)";
        newState.step = 'nd_location';
      } else {
        botResponse = `Please choose a valid option (1-${vehicleTypes.length}).`;
      }
      break;

    case 'nd_location':
      if (type === 'location' && location) {
        newState.userLocation = `${location.latitude},${location.longitude}`;
        botResponse = "🔍 Finding nearby drivers...";
        
        await sendWhatsAppMessage(from, botResponse);
        
        const drivers = await getNearbyDrivers(newState.userLocation, newState.selectedVehicleType!);
        newState.nearbyDrivers = drivers;
        
        const driversList = drivers.map((d, i) => 
          `${i + 1}️⃣ ${d.plate} • ${d.distance}km • ⭐${d.rating}`
        ).join('\n');
        const driversMsg = `🚗 **Top ${drivers.length} Nearby ${newState.selectedVehicleType} Drivers**\n\n${driversList}\n\nSelect driver:`;
        
        await sendWhatsAppMessage(from, driversMsg);
        newState.step = 'nd_driver_list';
        await updateConversationState(from, newState);
        return;
      } else {
        botResponse = "📍 Please share your location using the location button.";
      }
      break;

    case 'nd_driver_list':
      const driverIndex = parseInt(content) - 1;
      if (driverIndex >= 0 && driverIndex < (newState.nearbyDrivers?.length || 0)) {
        newState.selectedDriver = newState.nearbyDrivers![driverIndex];
        const driver = newState.selectedDriver;
        botResponse = `🚗 **Driver Details**\n\n🚗 ${driver.plate}\n📍 ${driver.distance}km away\n⭐ Rating: ${driver.rating}\n⏱️ ETA: ${driver.eta}\n\n**Actions:**\n1️⃣ Book this driver\n2️⃣ Open WhatsApp chat\n3️⃣ Back to list`;
        newState.step = 'nd_driver_detail';
      } else {
        botResponse = `Please choose a valid driver (1-${newState.nearbyDrivers?.length || 0}).`;
      }
      break;

    case 'nd_driver_detail':
      if (content === '1') {
        // Book driver
        botResponse = "✅ **Booking Confirmed!**\n\nDriver has been notified and will contact you shortly.";
        newState.step = 'main_menu';
      } else if (content === '2') {
        // Open WhatsApp chat
        const driverPhone = newState.selectedDriver?.profiles?.wa_phone || '0788123456';
        botResponse = `📞 **Driver Contact:**\n\nWhatsApp: ${driverPhone}\n\nYou can now message them directly.`;
        newState.step = 'main_menu';
      } else if (content === '3') {
        // Back to list
        const driversList = newState.nearbyDrivers!.map((d, i) => 
          `${i + 1}️⃣ ${d.plate} • ${d.distance}km • ⭐${d.rating}`
        ).join('\n');
        botResponse = `🚗 **Nearby Drivers**\n\n${driversList}\n\nSelect driver:`;
        newState.step = 'nd_driver_list';
      } else {
        botResponse = "Please choose an option:\n1️⃣ Book driver\n2️⃣ Open chat\n3️⃣ Back to list";
      }
      break;

    case 'av_usage_type':
      const types = ["Moto Taxi", "Cab", "Liffan", "Truck", "Rental", "Other"];
      const typeIndex = parseInt(content) - 1;
      if (typeIndex >= 0 && typeIndex < types.length) {
        newState.usageType = types[typeIndex].toLowerCase().replace(' ', '_');
        botResponse = "📄 **Upload Insurance Certificate**\n\nPlease upload a photo or PDF of your insurance certificate.\n\n(In real WhatsApp, tap attachment → Camera/Document)";
        newState.step = 'av_insurance_upload';
      } else {
        botResponse = `Please choose a valid usage type (1-${types.length}).`;
      }
      break;

    case 'av_insurance_upload':
      if ((type === 'image' && image) || (type === 'document' && document)) {
        botResponse = "📄 **Processing Insurance Document**\n\nExtracting vehicle information via OCR...";
        
        await sendWhatsAppMessage(from, botResponse);
        
        // Download and process the document
        const mediaId = image?.id || document?.id;
        if (mediaId) {
          const fileUrl = await downloadWhatsAppMedia(mediaId);
          if (fileUrl) {
            const userId = await findOrCreateUser(from);
            if (userId) {
              newState.user_id = userId;
              const result = await processVehicleDocument(fileUrl, userId, newState.usageType!);
              
              if (result.success) {
                const vehicleData = result.data.extracted_data;
                const successMsg = `✅ **Vehicle Added Successfully!**\n\n🚗 Plate: ${vehicleData.plate || 'N/A'}\n👤 Owner: ${vehicleData.owner || 'N/A'}\n🏢 Insurer: ${vehicleData.insurance_provider || 'N/A'}\n🎯 Usage: ${newState.usageType?.replace('_', ' ')}\n\n**Next Actions:**`;
                
                if (['moto_taxi', 'cab', 'liffan', 'truck'].includes(newState.usageType!)) {
                  const driverMsg = `${successMsg}\n✅ Driver features enabled!\n🚗 You can now receive passengers\n📅 Schedule trips available`;
                  await sendWhatsAppMessage(from, driverMsg);
                } else if (newState.usageType === 'rental') {
                  const rentalMsg = `${successMsg}\n🏠 Listed under Rentals\n📞 Owner chat enabled`;
                  await sendWhatsAppMessage(from, rentalMsg);
                } else {
                  const otherMsg = `${successMsg}\n📝 Stored as Other category`;
                  await sendWhatsAppMessage(from, otherMsg);
                }
              } else {
                await sendWhatsAppMessage(from, `❌ **OCR Processing Failed**\n\n${result.error || 'Unable to extract vehicle information.'}\n\nPlease try uploading again.`);
              }
            }
          }
        }
        
        newState.step = 'main_menu';
        await updateConversationState(from, newState);
        return;
      } else {
        botResponse = "📄 Please upload an insurance certificate (photo/PDF).";
      }
      break;

    // Add other cases following the same pattern...
    default:
      botResponse = "🚗 **Welcome to MoveRwanda!**\n\nChoose an option:\n1️⃣ Generate QR Code\n2️⃣ Nearby Drivers\n3️⃣ Schedule Trip\n4️⃣ Add Vehicle\n5️⃣ Get Motor Insurance\n6️⃣ More\n\nReply with number (1-6) or option name.";
      newState.step = 'main_menu';
  }

  // Send response and update state
  if (botResponse) {
    await sendWhatsAppMessage(from, botResponse);
  }
  
  await updateConversationState(from, newState);
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
      console.log('📨 Incoming webhook payload:', JSON.stringify(body, null, 2));
      
      // Log the structure for debugging
      console.log('Body structure check:', {
        hasEntry: !!body.entry,
        entryType: typeof body.entry,
        entryLength: Array.isArray(body.entry) ? body.entry.length : 'not array'
      });

      if (body.entry && Array.isArray(body.entry)) {
        console.log(`Processing ${body.entry.length} entries`);
        
        for (const entry of body.entry) {
          console.log('Entry structure:', {
            hasChanges: !!entry.changes,
            changesType: typeof entry.changes,
            changesLength: Array.isArray(entry.changes) ? entry.changes.length : 'not array'
          });
          
          if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              console.log('Change structure:', {
                hasValue: !!change.value,
                hasMessages: !!change.value?.messages,
                messagesLength: Array.isArray(change.value?.messages) ? change.value.messages.length : 'not array',
                hasStatuses: !!change.value?.statuses,
                statusesLength: Array.isArray(change.value?.statuses) ? change.value.statuses.length : 'not array'
              });
              
              if (change.value?.messages && Array.isArray(change.value.messages)) {
                for (const message of change.value.messages) {
                  console.log(`🔄 Processing message:`, {
                    from: message.from,
                    type: message.type,
                    timestamp: message.timestamp
                  });
                  
                  try {
                    await processConversationFlow(message);
                    console.log(`✅ Successfully processed message from ${message.from}`);
                  } catch (error) {
                    console.error(`❌ Error processing message from ${message.from}:`, error);
                  }
                }
              }
              
              if (change.value?.statuses && Array.isArray(change.value.statuses)) {
                for (const status of change.value.statuses) {
                  console.log('📊 Message status update:', status);
                }
              }
            }
          }
        }
      } else {
        console.log('⚠️ No entry array found in webhook payload');
      }

      return new Response('OK', { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
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