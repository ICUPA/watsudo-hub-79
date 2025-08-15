import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Environment variables - these MUST be set in Supabase secrets
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
const WHATSAPP_APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET');

// Initialize Supabase client with service role for full access
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Debug environment variables at startup
console.log('🔧 WhatsApp Webhook Environment Check:', {
  hasVerifyToken: !!VERIFY_TOKEN,
  hasAccessToken: !!WHATSAPP_ACCESS_TOKEN,
  hasPhoneId: !!WHATSAPP_PHONE_NUMBER_ID,
  hasAppSecret: !!WHATSAPP_APP_SECRET,
  verifyTokenLength: VERIFY_TOKEN?.length || 0,
  accessTokenLength: WHATSAPP_ACCESS_TOKEN?.length || 0,
  phoneIdLength: WHATSAPP_PHONE_NUMBER_ID?.length || 0
});

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
        'ins_quotation_pending' | 'ins_quotation_received' | 'ins_payment_plan' | 'ins_payment_pending' | 'ins_certificate';
  
  userMomo?: string;
  qrAmount?: number;
  selectedVehicleType?: string;
  userLocation?: string;
  nearbyDrivers?: any[];
  selectedDriver?: any;
  rideData?: any;
  extractedData?: any;
  ownerPhone?: string;
  usageType?: string;
  tripRole?: 'passenger' | 'driver';
  pickupLocation?: string;
  dropoffLocation?: string;
  scheduledTime?: string;
  hasVehicleOnFile?: boolean;
  insuranceStartDate?: string;
  selectedPeriod?: string;
  selectedAddons?: number[];
  selectedPACategory?: string;
  insuranceQuoteId?: string;
  user_id?: string;
}

// ============= CONVERSATION STATE MANAGEMENT =============

async function getConversationState(phoneNumber: string): Promise<ConversationState> {
  try {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (error || !data) {
      // Create new conversation state
      const newState: ConversationState = { step: 'main_menu' };
      
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
  } catch (error) {
    console.error('Error getting conversation state:', error);
    return { step: 'main_menu' };
  }
}

async function updateConversationState(phoneNumber: string, newState: ConversationState) {
  try {
    await supabase
      .from('whatsapp_conversations')
      .upsert({
        phone_number: phoneNumber,
        user_id: newState.user_id,
        current_step: newState.step,
        conversation_data: newState,
        last_activity_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error updating conversation state:', error);
  }
}

// ============= USER MANAGEMENT =============

async function findOrCreateUser(phoneNumber: string): Promise<string | null> {
  try {
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
  } catch (error) {
    console.error('Error in findOrCreateUser:', error);
    return null;
  }
}

// ============= WHATSAPP API FUNCTIONS =============

async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  try {
    // Validate environment variables
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
      console.error('❌ Missing WhatsApp credentials:', { 
        hasPhoneId: !!WHATSAPP_PHONE_NUMBER_ID, 
        hasToken: !!WHATSAPP_ACCESS_TOKEN,
        phoneIdValue: WHATSAPP_PHONE_NUMBER_ID ? `${WHATSAPP_PHONE_NUMBER_ID.substring(0, 4)}...` : 'null',
        tokenValue: WHATSAPP_ACCESS_TOKEN ? `${WHATSAPP_ACCESS_TOKEN.substring(0, 10)}...` : 'null'
      });
      return false;
    }

    console.log('📤 Sending WhatsApp message to:', to);
    
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
      console.log('✅ Message sent successfully');
      await logWhatsAppMessage(to, 'outbound', message, result.messages?.[0]?.id, 'sent');
      return true;
    } else {
      console.error('❌ WhatsApp API error:', { 
        status: response.status, 
        statusText: response.statusText,
        result 
      });
      await logWhatsAppMessage(to, 'outbound', message, undefined, 'failed', { error: result });
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
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

// ============= CONVERSATION FLOW PROCESSOR =============

async function processConversationFlow(message: WhatsAppMessage): Promise<void> {
  try {
    const { from, text, type } = message;
    const content = text?.body?.toLowerCase().trim() || '';
    
    // Get current conversation state
    let conversationState = await getConversationState(from);
    
    console.log(`🔄 Processing step: ${conversationState.step} for ${from}`);
    console.log(`📩 Message: ${content}`);
    
    // Log incoming message
    await logWhatsAppMessage(from, 'inbound', text?.body || `[${type}]`, message.id);

    let botResponse = "";
    let newState = { ...conversationState };

    // Process main conversation flow
    switch (conversationState.step) {
      case 'main_menu':
        if (content === '1' || content.includes('qr') || content.includes('generate')) {
          botResponse = "💳 **Generate QR Code**\n\nChoose amount mode:\n1️⃣ With amount\n2️⃣ No amount (recipient chooses)";
          newState.step = 'qr_amount';
          newState.userMomo = '0788767816'; // Mock MoMo for testing
        }
        else if (content === '2' || content.includes('nearby') || content.includes('driver')) {
          botResponse = "🚗 **Nearby Drivers**\n\nSearching for drivers near your location...";
          newState.step = 'nd_driver_list';
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
          botResponse = "🛡️ **Motor Insurance**\n\nChecking your vehicle records...";
          newState.step = 'insurance';
        }
        else {
          botResponse = "🚗 **Welcome to MoveRwanda!**\n\nChoose an option:\n1️⃣ Generate QR Code\n2️⃣ Nearby Drivers\n3️⃣ Schedule Trip\n4️⃣ Add Vehicle\n5️⃣ Get Motor Insurance\n6️⃣ More\n\nReply with number (1-6) or option name.";
        }
        break;

      case 'qr_amount':
        if (content === '1') {
          botResponse = "💰 **Set Amount**\n\nQuick pick:\n1️⃣ 1,000 RWF\n2️⃣ 2,000 RWF\n3️⃣ 5,000 RWF\n4️⃣ Other amount";
          newState.step = 'qr_amount_pick';
        } else if (content === '2') {
          const ussdCode = `*182*1*1*${newState.userMomo}#`;
          botResponse = `✅ **QR Code Generated!**\n\n💳 MoMo: ${newState.userMomo}\n💰 Amount: Recipient chooses\n📱 USSD: ${ussdCode}\n\n**Actions:**\n• Generate another\n• Home`;
          newState.step = 'main_menu';
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
        
        const ussdCode = `*182*1*1*${newState.userMomo}*${amount}#`;
        botResponse = `✅ **QR Code Generated!**\n\n💳 MoMo: ${newState.userMomo}\n💰 Amount: ${amount.toLocaleString()} RWF\n📱 USSD: ${ussdCode}\n\n**Actions:**\n• Generate another\n• Home`;
        newState.step = 'main_menu';
        break;

      case 'qr_amount_custom':
        const customAmount = parseInt(content.replace(/[^0-9]/g, ''));
        if (customAmount > 0) {
          const ussdCode = `*182*1*1*${newState.userMomo}*${customAmount}#`;
          botResponse = `✅ **QR Code Generated!**\n\n💳 MoMo: ${newState.userMomo}\n💰 Amount: ${customAmount.toLocaleString()} RWF\n📱 USSD: ${ussdCode}\n\n**Actions:**\n• Generate another\n• Home`;
          newState.step = 'main_menu';
        } else {
          botResponse = "❌ Invalid amount. Please enter a valid number (e.g., 3500):";
        }
        break;

      default:
        botResponse = "🚗 **Welcome to MoveRwanda!**\n\nChoose an option:\n1️⃣ Generate QR Code\n2️⃣ Nearby Drivers\n3️⃣ Schedule Trip\n4️⃣ Add Vehicle\n5️⃣ Get Motor Insurance\n6️⃣ More\n\nReply with number (1-6) or option name.";
        newState.step = 'main_menu';
    }

    // Send response and update state
    if (botResponse) {
      const sent = await sendWhatsAppMessage(from, botResponse);
      if (!sent) {
        console.error('❌ Failed to send message to:', from);
      }
    }
    
    await updateConversationState(from, newState);
  } catch (error) {
    console.error('❌ Error processing conversation flow:', error);
  }
}

// ============= WEBHOOK HANDLER =============

Deno.serve(async (req) => {
  console.log(`${req.method} ${req.url}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle webhook verification (GET request)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('🔐 Webhook verification request:', { mode, token: token ? 'provided' : 'missing', challenge: challenge ? 'provided' : 'missing' });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verified successfully');
      return new Response(challenge, { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    } else {
      console.log('❌ Webhook verification failed:', { 
        modeMatch: mode === 'subscribe', 
        tokenMatch: token === VERIFY_TOKEN,
        expectedToken: VERIFY_TOKEN ? 'configured' : 'missing'
      });
      return new Response('Forbidden', { status: 403 });
    }
  }

  // Handle webhook messages (POST request)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      
      console.log('📨 Incoming webhook payload:', JSON.stringify(body, null, 2));

      if (body.object === 'whatsapp_business_account') {
        if (body.entry && Array.isArray(body.entry)) {
          for (const entry of body.entry) {
            if (entry.changes && Array.isArray(entry.changes)) {
              for (const change of entry.changes) {
                if (change.value?.messages && Array.isArray(change.value.messages)) {
                  for (const message of change.value.messages) {
                    console.log('🔄 Processing message:', { from: message.from, type: message.type, timestamp: message.timestamp });
                    await processConversationFlow(message);
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