import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VERIFY_TOKEN = 'bd0e7b6f4a2c9d83f1e57a0c6b3d48e9';
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: {
    body: string;
  };
  type: string;
}

interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      messages?: WhatsAppMessage[];
      statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
      }>;
    };
    field: string;
  }>;
}

async function logWhatsAppMessage(
  phoneNumber: string,
  direction: 'inbound' | 'outbound',
  content: string,
  messageId?: string,
  status?: string,
  metadata?: any
) {
  try {
    const { error } = await supabase
      .from('whatsapp_logs')
      .insert({
        phone_number: phoneNumber,
        direction,
        message_content: content,
        message_id: messageId,
        status: status || 'received',
        metadata: metadata || {}
      });

    if (error) {
      console.error('Error logging WhatsApp message:', error);
    }
  } catch (error) {
    console.error('Error logging WhatsApp message:', error);
  }
}

async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: {
            body: message
          }
        })
      }
    );

    const result = await response.json();
    
    if (response.ok) {
      // Log outbound message
      await logWhatsAppMessage(to, 'outbound', message, result.messages?.[0]?.id, 'sent');
      return true;
    } else {
      console.error('WhatsApp API error:', result);
      await logWhatsAppMessage(to, 'outbound', message, undefined, 'failed', { error: result });
      return false;
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    await logWhatsAppMessage(to, 'outbound', message, undefined, 'failed', { error: error.message });
    return false;
  }
}

async function processWhatsAppMessage(message: WhatsAppMessage) {
  const { from, text, type } = message;
  
  if (type !== 'text' || !text?.body) {
    console.log('Non-text message received, ignoring');
    return;
  }

  const messageText = text.body.toLowerCase().trim();
  
  // Log incoming message
  await logWhatsAppMessage(from, 'inbound', text.body, message.id);

  // Simple bot responses based on message content
  let response = '';

  if (messageText.includes('hello') || messageText.includes('hi') || messageText === '1') {
    response = `🚗 *Welcome to MoveRwanda!* 🇷🇼

Choose an option:
1️⃣ Generate QR Code 
2️⃣ Nearby Drivers
3️⃣ Schedule Trip
4️⃣ Add Vehicle
5️⃣ Motor Insurance
6️⃣ Help

Reply with a number to continue.`;
  } else if (messageText === '2') {
    response = `🚗 *Generate QR Code for MoMo Payment*

I'll help you create a QR code for mobile money payments.

Please share your MoMo number (07XXXXXXXX):`;
  } else if (messageText === '3') {
    response = `🚕 *Find Nearby Drivers*

Let me help you find drivers in your area.

Please share your current location using the 📍 location button.`;
  } else if (messageText === '4') {
    response = `📅 *Schedule a Trip*

Are you a:
1️⃣ Passenger (looking for a ride)
2️⃣ Driver (offering a ride)

Reply with 1 or 2.`;
  } else if (messageText === '5') {
    response = `🚗 *Add Your Vehicle*

To add your vehicle, please upload a clear photo of your vehicle's insurance certificate.

This will help us verify your vehicle details automatically.`;
  } else if (messageText === '6') {
    response = `🏍️ *Motor Insurance*

Get affordable motor insurance for your vehicle.

Do you already have a vehicle registered with us?
1️⃣ Yes, I have a vehicle
2️⃣ No, I need to add my vehicle first

Reply with 1 or 2.`;
  } else if (messageText.includes('help') || messageText === '7') {
    response = `ℹ️ *MoveRwanda Help*

Available services:
🔸 QR Code generation for payments
🔸 Find nearby drivers
🔸 Schedule trips
🔸 Vehicle registration
🔸 Motor insurance

Type "menu" or "1" to see the main menu.

For technical support, contact: support@moverwanda.com`;
  } else if (messageText.includes('menu')) {
    response = `🚗 *Main Menu*

1️⃣ Generate QR Code 
2️⃣ Nearby Drivers
3️⃣ Schedule Trip
4️⃣ Add Vehicle
5️⃣ Motor Insurance
6️⃣ Help

Reply with a number.`;
  } else {
    response = `I didn't understand that. Type "menu" or "1" to see available options.`;
  }

  // Send response
  if (response) {
    await sendWhatsAppMessage(from, response);
  }
}

Deno.serve(async (req) => {
  console.log(`${req.method} ${req.url}`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET request for webhook verification
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('Webhook verification request:', { mode, token, challenge });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified successfully');
      return new Response(challenge, { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    } else {
      console.log('Webhook verification failed');
      return new Response('Forbidden', { status: 403 });
    }
  }

  // Handle POST request for incoming messages
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('Incoming webhook:', JSON.stringify(body, null, 2));

      // Process each entry in the webhook payload
      if (body.entry && Array.isArray(body.entry)) {
        for (const entry of body.entry as WhatsAppWebhookEntry[]) {
          if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              if (change.value.messages && Array.isArray(change.value.messages)) {
                for (const message of change.value.messages) {
                  await processWhatsAppMessage(message);
                }
              }
              
              // Handle message status updates
              if (change.value.statuses && Array.isArray(change.value.statuses)) {
                for (const status of change.value.statuses) {
                  console.log('Message status update:', status);
                  // You can log status updates here if needed
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
      console.error('Error processing webhook:', error);
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