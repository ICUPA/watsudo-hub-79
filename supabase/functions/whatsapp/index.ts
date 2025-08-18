
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const META_VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN') || 'your_verify_token'
const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN')
const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

console.log('WhatsApp Edge Function initialized')

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  console.log(`${req.method} ${url.pathname}`)

  try {
    // Handle webhook verification (GET request)
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      console.log('Webhook verification:', { mode, token, challenge })

      if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
        console.log('Webhook verified successfully')
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain', ...corsHeaders }
        })
      } else {
        console.log('Webhook verification failed')
        return new Response('Forbidden', {
          status: 403,
          headers: corsHeaders
        })
      }
    }

    // Handle webhook events (POST request)
    if (req.method === 'POST') {
      const body = await req.json()
      console.log('Received webhook payload:', JSON.stringify(body, null, 2))

      // Log the incoming webhook
      await supabase.from('whatsapp_logs').insert({
        direction: 'in',
        payload: body,
        message_type: 'webhook',
        status: 'received'
      })

      // Process webhook entries
      if (body.entry && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              if (change.value && change.value.messages) {
                await processMessages(change.value.messages, change.value.contacts)
              }
            }
          }
        }
      }

      return new Response('OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      })
    }

    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    })

  } catch (error) {
    console.error('Error processing webhook:', error)
    
    // Log error to database
    await supabase.from('whatsapp_logs').insert({
      direction: 'in',
      payload: { error: error.message },
      message_type: 'error',
      status: 'error'
    })

    return new Response('Internal Server Error', {
      status: 500,
      headers: corsHeaders
    })
  }
})

async function processMessages(messages: any[], contacts: any[] = []) {
  console.log('Processing messages:', messages.length)

  for (const message of messages) {
    try {
      const contact = contacts?.find(c => c.wa_id === message.from)
      const phoneNumber = `+${message.from}`
      
      console.log('Processing message from:', phoneNumber, 'Type:', message.type)

      // Log message to database
      await supabase.from('whatsapp_logs').insert({
        direction: 'in',
        phone_number: phoneNumber,
        message_type: message.type,
        message_content: getMessageContent(message),
        message_id: message.id,
        payload: message,
        metadata: { contact },
        status: 'received'
      })

      // Update or create conversation
      await updateConversation(phoneNumber, message, contact)

      // Process the message and send response
      await handleIncomingMessage(phoneNumber, message, contact)

    } catch (error) {
      console.error('Error processing individual message:', error)
    }
  }
}

function getMessageContent(message: any): string {
  switch (message.type) {
    case 'text':
      return message.text?.body || ''
    case 'image':
      return 'Image message'
    case 'document':
      return 'Document message'
    case 'audio':
      return 'Audio message'
    case 'video':
      return 'Video message'
    case 'location':
      return 'Location message'
    case 'interactive':
      return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || 'Interactive message'
    default:
      return 'Unknown message type'
  }
}

async function updateConversation(phoneNumber: string, message: any, contact: any) {
  try {
    // Check if conversation exists
    const { data: existingConversation } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single()

    if (existingConversation) {
      // Update existing conversation
      await supabase
        .from('whatsapp_conversations')
        .update({
          last_activity_at: new Date().toISOString(),
          conversation_data: {
            ...existingConversation.conversation_data,
            last_message: getMessageContent(message),
            last_message_type: message.type
          }
        })
        .eq('id', existingConversation.id)
    } else {
      // Create new conversation
      await supabase
        .from('whatsapp_conversations')
        .insert({
          phone_number: phoneNumber,
          current_step: 'MAIN_MENU',
          conversation_data: {
            contact_name: contact?.profile?.name || 'Unknown',
            last_message: getMessageContent(message),
            last_message_type: message.type
          },
          last_activity_at: new Date().toISOString()
        })
    }
  } catch (error) {
    console.error('Error updating conversation:', error)
  }
}

async function handleIncomingMessage(phoneNumber: string, message: any, contact: any) {
  try {
    let responseText = ''

    // Simple message handling based on content
    const messageContent = getMessageContent(message).toLowerCase()

    if (messageContent.includes('hello') || messageContent.includes('hi') || messageContent === '') {
      responseText = 'Hello! Welcome to our service. How can I help you today?\n\n1. 🚕 Mobility Services\n2. 🛡️ Insurance\n3. 🔳 QR Code Generator\n4. 👤 Profile'
    } else if (messageContent.includes('mobility') || messageContent === '1') {
      responseText = 'Mobility Services:\n\n1. Find Nearby Drivers\n2. Schedule a Trip\n3. Add Vehicle (with OCR)\n\nPlease select an option or type your choice.'
    } else if (messageContent.includes('insurance') || messageContent === '2') {
      responseText = 'Insurance Services:\n\nWe provide motorcycle insurance with quick quotes and digital certificates.\n\nWould you like to get a quote?'
    } else if (messageContent.includes('qr') || messageContent === '3') {
      responseText = 'QR Code Generator:\n\nI can help you generate QR codes for mobile money payments.\n\nWould you like to create a QR code?'
    } else if (messageContent.includes('profile') || messageContent === '4') {
      responseText = `Profile Information:\n\nPhone: ${phoneNumber}\nName: ${contact?.profile?.name || 'Not set'}\n\nHow can I help you with your profile?`
    } else {
      responseText = 'Thank you for your message. I\'m here to help with:\n\n🚕 Mobility Services\n🛡️ Insurance\n🔳 QR Codes\n👤 Profile\n\nPlease let me know what you need assistance with.'
    }

    // Send response
    await sendWhatsAppMessage(phoneNumber.replace('+', ''), responseText)

  } catch (error) {
    console.error('Error handling incoming message:', error)
  }
}

async function sendWhatsAppMessage(to: string, text: string) {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    console.error('Missing WhatsApp API credentials')
    return
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${META_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      })
    })

    const result = await response.json()
    console.log('WhatsApp API response:', result)

    // Log outgoing message
    await supabase.from('whatsapp_logs').insert({
      direction: 'out',
      phone_number: `+${to}`,
      message_type: 'text',
      message_content: text,
      message_id: result.messages?.[0]?.id,
      payload: result,
      status: response.ok ? 'sent' : 'failed'
    })

  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    
    // Log failed message
    await supabase.from('whatsapp_logs').insert({
      direction: 'out',
      phone_number: `+${to}`,
      message_type: 'text',
      message_content: text,
      payload: { error: error.message },
      status: 'failed'
    })
  }
}
