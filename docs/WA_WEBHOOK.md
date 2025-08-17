# WhatsApp Webhook Implementation Guide

## Overview

This document describes the WhatsApp Business Cloud API webhook implementation for the Mobility + USSD QR Hub. The webhook handles incoming messages, interactive responses, and media uploads with a focus on fast response times and reliable message processing.

## Architecture

### Components
1. **WhatsApp Webhook** (`/functions/v1/whatsapp`) - Main message handler
2. **OCR Worker** (`/functions/v1/ocr_worker`) - Async media processing
3. **Database Tables** - Message logging, user sessions, OCR jobs
4. **Storage Buckets** - Media files, QR codes, documents

### Flow Diagram
```
WhatsApp → Webhook → Fast Response (200) → Background Processing
                ↓
            Log Message → Update Session → Send Response
                ↓
            Media Files → Queue OCR Job → Worker Processes
```

## Webhook Configuration

### Meta Developer Dashboard Setup
1. **Webhook URL**: `https://your-project.supabase.co/functions/v1/whatsapp`
2. **Verify Token**: Must match `META_WABA_VERIFY_TOKEN` environment variable
3. **Webhook Fields**: Subscribe to `messages`, `message_status_updates`
4. **App Status**: Must be in **Live** mode or have test phone numbers

### Environment Variables
```bash
# Required for webhook operation
META_PHONE_NUMBER_ID=your-phone-number-id
META_ACCESS_TOKEN=your-access-token
META_WABA_VERIFY_TOKEN=your-verify-token
META_WABA_APP_SECRET=your-app-secret

# Database and storage
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OCR processing
OPENAI_API_KEY=your-openai-api-key
```

## Webhook Verification

### GET Request (Verification)
Meta sends a verification request when setting up the webhook:

```
GET /functions/v1/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE_STRING
```

**Response**: Return the challenge string exactly as received
```typescript
if (mode === "subscribe" && token === WABA_VERIFY) {
  return new Response(challenge ?? "", { 
    status: 200, 
    headers: { "Content-Type": "text/plain" } 
  });
}
```

### POST Request (Message Handling)
All incoming messages are sent as POST requests with the following structure:

#### Headers
- `Content-Type: application/json`
- `X-Hub-Signature-256: sha256=HMAC_SIGNATURE`

#### Signature Verification
```typescript
// Verify webhook signature using HMAC SHA-256
const isValidSignature = await waClient.verifySignature(signature || "", bodyText);
if (!isValidSignature) {
  logger.log("warn", "Invalid webhook signature", { requestId, signature });
  return new Response("Invalid signature", { status: 403 });
}
```

## Payload Structure

### Incoming Message Format
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "PHONE_NUMBER",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "contacts": [
              {
                "profile": {
                  "name": "USER_NAME"
                },
                "wa_id": "USER_PHONE_NUMBER"
              }
            ],
            "messages": [
              {
                "id": "MESSAGE_ID",
                "from": "USER_PHONE_NUMBER",
                "timestamp": "TIMESTAMP",
                "type": "text|image|document|interactive|location",
                "text": {
                  "body": "Message content"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

### Message Types

#### Text Messages
```json
{
  "type": "text",
  "text": {
    "body": "Hello, how can I help you?"
  }
}
```

#### Interactive Messages (Buttons)
```json
{
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "BUTTON_ID",
      "title": "Button Title"
    }
  }
}
```

#### Interactive Messages (Lists)
```json
{
  "type": "interactive",
  "interactive": {
    "type": "list_reply",
    "list_reply": {
      "id": "LIST_ITEM_ID",
      "title": "Item Title",
      "description": "Item Description"
    }
  }
}
```

#### Media Messages
```json
{
  "type": "image",
  "image": {
    "id": "MEDIA_ID",
    "mime_type": "image/jpeg",
    "sha256": "HASH",
    "caption": "Optional caption"
  }
}
```

#### Location Messages
```json
{
  "type": "location",
  "location": {
    "latitude": 1.2345,
    "longitude": 2.3456,
    "name": "Location Name",
    "address": "Full Address"
  }
}
```

## Message Processing

### Processing Flow
1. **Signature Verification** - Validate webhook authenticity
2. **Idempotency Check** - Prevent duplicate processing
3. **Message Logging** - Store inbound message in database
4. **User/Session Management** - Get or create user profile
5. **Message Routing** - Route based on type and session state
6. **Response Generation** - Send appropriate WhatsApp message
7. **State Update** - Update user's conversation state

### State Machine
```typescript
const STATES = {
  MAIN_MENU: "MAIN_MENU",
  MOBILITY_MENU: "MOBILITY_MENU",
  INS_CHECK_VEHICLE: "INS_CHECK_VEHICLE",
  INS_COLLECT_DOCS: "INS_COLLECT_DOCS",
  AV_DOC: "AV_DOC",
  QR_MENU: "QR_MENU",
  // ... more states
};
```

### Interactive Response Handling
```typescript
// Extract interactive ID from message
const iid = getInteractiveId(m);
if (iid) {
  // Validate flow ID
  if (!isValidFlowId(iid)) {
    await waClient.sendText(to, "Sorry, I didn't understand that. Let me show you the main menu.");
    await setState(session.id, STATES.MAIN_MENU, {});
    await showMainMenu(to);
    return;
  }
  
  // Route to appropriate handler
  if (iid === "MOBILITY") {
    await setState(session.id, STATES.MOBILITY_MENU, {});
    await showMobilityMenu(to);
  }
  // ... more handlers
}
```

## Response Generation

### Message Types

#### Text Messages
```typescript
await waClient.sendText(to, "Welcome to our service!");
```

#### Button Messages
```typescript
await waClient.sendButtons(to, "Choose a service:", [
  { id: "MOBILITY", title: "🚕 Mobility" },
  { id: "INSURANCE", title: "🛡️ Insurance" },
  { id: "QR", title: "🔳 QR Codes" }
]);
```

#### List Messages
```typescript
await waClient.sendList(to, "Select vehicle type:", [
  { id: "ND_V_MOTO", title: "Moto Taxi" },
  { id: "ND_V_CAB", title: "Cab" },
  { id: "ND_V_LIFFAN", title: "Liffan (Goods)" }
], "Vehicle Types", "Nearby Drivers");
```

#### Media Messages
```typescript
await waClient.sendImage(to, imageUrl, "Your QR code");
await waClient.sendDocument(to, documentUrl, "Insurance certificate");
```

### Response Format
```json
{
  "messaging_product": "whatsapp",
  "to": "RECIPIENT_PHONE",
  "type": "text|interactive|image|document",
  "text": {
    "body": "Message content"
  }
}
```

## Media Processing

### Fast-Ack Pattern
To meet Meta's 8-second response requirement, media processing uses a fast-ack pattern:

1. **Immediate Response**: Send "Processing..." message to user
2. **Job Queuing**: Store media processing job in database
3. **Webhook Return**: Return HTTP 200 immediately
4. **Background Processing**: OCR worker processes jobs asynchronously

### OCR Job Structure
```sql
CREATE TABLE vehicle_ocr_jobs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  media_id TEXT NOT NULL,
  usage_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  result_data JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### OCR Worker Flow
1. **Poll for Jobs**: Check for pending OCR jobs
2. **Fetch Media**: Download from WhatsApp using media ID
3. **Upload to Storage**: Store in Supabase storage bucket
4. **Process with OpenAI**: Extract vehicle information using GPT-4o Vision
5. **Store Results**: Save vehicle data to database
6. **Notify User**: Send WhatsApp message with results
7. **Update Job Status**: Mark job as completed or failed

## Error Handling

### Webhook Error Responses
- **200 OK**: Successful processing
- **403 Forbidden**: Invalid signature or verification failed
- **500 Internal Error**: Server error (should be avoided)

### Error Logging
```typescript
try {
  // Process message
} catch (error) {
  logger.log("error", "Request processing failed", { 
    error: error.message, 
    stack: error.stack, 
    requestId 
  });
  
  // Try to send error message to user
  try {
    await waClient.sendText(contact.wa_id, "Sorry, something went wrong. Please try again.");
  } catch (fallbackError) {
    logger.log("error", "Failed to send error message to user", { error: fallbackError.message });
  }
  
  return new Response("Internal server error", { status: 500 });
}
```

### Retry Logic
- **OCR Jobs**: Up to 3 attempts with exponential backoff
- **WhatsApp API**: Up to 3 retries for transient failures
- **Database Operations**: Single attempt (fail fast)

## Performance Considerations

### Response Time Requirements
- **Meta Requirement**: < 8 seconds
- **Target**: < 3 seconds for text messages
- **Media Processing**: Immediate ack + background processing

### Database Optimization
```sql
-- Critical indexes for performance
CREATE INDEX idx_whatsapp_logs_message_id ON whatsapp_logs(message_id);
CREATE INDEX idx_whatsapp_logs_phone_direction ON whatsapp_logs(phone_number, direction);
CREATE INDEX idx_vehicle_ocr_jobs_pending ON vehicle_ocr_jobs(status, created_at) WHERE status = 'pending';
```

### Caching Strategy
- **User Sessions**: Cache in memory for active conversations
- **Vehicle Types**: Cache static data
- **Insurance Data**: Cache lookup tables

## Security

### Signature Verification
```typescript
async verifySignature(signature: string, body: string): Promise<boolean> {
  if (!signature) return false;
  
  const [algo, digest] = signature.split("=");
  if (algo !== "sha256" || !digest) return false;
  
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(this.appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  
  const hexBytes = new Uint8Array(digest.length / 2);
  for (let i = 0; i < digest.length; i += 2) {
    hexBytes[i / 2] = parseInt(digest.slice(i, i + 2), 16);
  }
  
  return await crypto.subtle.verify("HMAC", key, hexBytes, new TextEncoder().encode(body));
}
```

### Input Validation
- **Phone Numbers**: Normalize to E.164 format
- **Interactive IDs**: Validate against allowed flow IDs
- **Message Content**: Sanitize user input

### Rate Limiting
- **Per User**: Limit message frequency
- **Global**: Prevent abuse of webhook endpoint
- **OCR Jobs**: Process in batches to avoid overwhelming APIs

## Testing

### Test Payloads
```json
// Text message test
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "test",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "phone_number_id": "test" },
        "contacts": [{ "wa_id": "250700000000", "profile": { "name": "Test User" } }],
        "messages": [{ "id": "test_msg", "from": "250700000000", "type": "text", "text": { "body": "hello" } }]
      },
      "field": "messages"
    }]
  }]
}
```

### Testing Commands
```bash
# Test webhook health
curl -X GET "https://your-project.supabase.co/functions/v1/whatsapp/health"

# Test webhook verification
curl -X GET "https://your-project.supabase.co/functions/v1/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"

# Test message processing (with valid signature)
curl -X POST "https://your-project.supabase.co/functions/v1/whatsapp" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=VALID_SIGNATURE" \
  -d @test-payload.json
```

## Monitoring

### Key Metrics
- **Response Time**: Average webhook response time
- **Success Rate**: Percentage of successful message processing
- **Error Rate**: Types and frequency of errors
- **OCR Success Rate**: Percentage of successful OCR processing

### Logging
```typescript
// Structured logging with correlation IDs
logger.log("info", "Processing message", { 
  messageId, 
  messageType: m.type, 
  userId: user.id, 
  sessionState: session.state,
  requestId 
});
```

### Health Checks
- **Webhook Endpoint**: `/health` returns system status
- **Database Connectivity**: Verify database access
- **External APIs**: Check WhatsApp and OpenAI API status

## Troubleshooting

### Common Issues

#### Webhook Not Responding
1. Check function deployment status
2. Verify environment variables
3. Check Supabase function logs
4. Test endpoint manually

#### Signature Verification Failing
1. Verify `META_WABA_APP_SECRET` is correct
2. Check signature header format
3. Ensure raw body is used for verification

#### Messages Not Being Processed
1. Check message format in logs
2. Verify user/session creation
3. Check for errors in processing logic

#### OCR Processing Failing
1. Check OCR worker function status
2. Verify OpenAI API key and quota
3. Check job queue in database
4. Review error messages in job records

### Debug Mode
```typescript
// Enable detailed logging
const DEBUG = Deno.env.get("DEBUG") === "true";
if (DEBUG) {
  logger.log("debug", "Raw webhook payload", { body, headers: Object.fromEntries(req.headers) });
}
```

## Best Practices

### Message Processing
1. **Always return 200**: Never fail the webhook response
2. **Process asynchronously**: Move heavy operations to background
3. **Handle all message types**: Support text, interactive, media, location
4. **Validate inputs**: Sanitize and validate user input

### Error Handling
1. **Log everything**: Include context and correlation IDs
2. **Graceful degradation**: Provide fallback responses
3. **User notification**: Inform users of processing status
4. **Retry logic**: Implement appropriate retry strategies

### Performance
1. **Fast response**: Return webhook response quickly
2. **Efficient queries**: Use database indexes and optimize queries
3. **Batch processing**: Process multiple items when possible
4. **Resource management**: Reuse connections and avoid memory leaks

## Conclusion

This webhook implementation provides a robust, scalable solution for handling WhatsApp Business messages. The fast-ack pattern ensures compliance with Meta's requirements while maintaining a responsive user experience. The async processing architecture allows for complex operations like OCR without blocking message delivery.

Key success factors:
- **Fast response times** (< 3 seconds for text, immediate ack for media)
- **Comprehensive error handling** with user notifications
- **Efficient state management** for conversation flow
- **Secure signature verification** for webhook authenticity
- **Scalable background processing** for heavy operations
