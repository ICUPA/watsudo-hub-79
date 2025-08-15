# Mobility + USSD QR Hub — Production Setup Guide

## Overview
A WhatsApp-first mobility and payment platform with QR code generation, insurance quotes, and ride booking capabilities.

## Features
- **WhatsApp Integration**: Users interact exclusively via WhatsApp
- **QR Codes**: Generate MoMo USSD QR codes with phone or merchant codes
- **Insurance**: Moto insurance with OCR document processing
- **Mobility**: Nearby drivers, ride booking, vehicle management
- **Admin Panel**: Web dashboard for monitoring and management

## Prerequisites
- Supabase project with PostGIS enabled
- WhatsApp Business API account
- OpenAI API key (for OCR)

## Environment Variables

### Required for Edge Functions
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_VERIFY_TOKEN=your-verify-token
WHATSAPP_APP_SECRET=your-app-secret
OPENAI_API_KEY=your-openai-api-key
TIMEZONE=Africa/Kigali
```

### Required for Admin Panel
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Database Setup

1. **Extensions**: PostGIS and pgcrypto are automatically enabled
2. **Storage Buckets**: 
   - `qr` (public) - QR code images
   - `vehicle_docs` (private) - Insurance certificates
   - `quotes` (private) - Quote PDFs
   - `certificates` (private) - Insurance certificates

3. **Core Tables**:
   - `profiles` - User profiles and WhatsApp data
   - `chat_sessions` - Conversation state management
   - `vehicles` - Vehicle records with OCR data
   - `drivers` - Driver profiles and locations
   - `rides` - Ride requests and tracking
   - `insurance_quotes` - Insurance quotations
   - `qr_generations` - QR code generation logs
   - `whatsapp_logs` - All WhatsApp interactions

## WhatsApp Setup

1. **Configure Webhook**:
   - URL: `https://your-project.supabase.co/functions/v1/whatsapp`
   - Verify Token: Use your `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to: `messages`

2. **Test Webhook**:
   ```bash
   curl -X GET "https://your-project.supabase.co/functions/v1/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"
   ```

## User Flows

### Main Menu
Users start with: Mobility • Insurance • QR Codes • Profile

### QR Code Generation
1. Choose identifier type (Phone or MoMo Code)
2. Select amount mode (With amount or No amount)
3. Receive QR image + tel: link for USSD dialing

### Insurance (Moto)
1. Upload insurance documents (OCR processing)
2. Select start date and period
3. Choose add-ons (Third-party, COMESA, Personal Accident)
4. Receive quotation PDF
5. Pay via USSD
6. Receive certificate

### Mobility
1. **Nearby Drivers**: Share location → See available drivers
2. **Schedule Trip**: Set pickup/dropoff + time window
3. **Add Vehicle**: Upload insurance cert for OCR parsing

## Admin Panel Features

- **Dashboard**: Overview of users, rides, quotes
- **User Management**: View/edit user profiles and settings
- **Vehicle Management**: Verify vehicles and view documents
- **Insurance Backoffice**: Attach quotes, issue certificates
- **WhatsApp Logs**: Monitor all conversations
- **QR Generator**: Admin QR code generation tool

## Production Deployment

### 1. Set Environment Variables
Add all required variables to:
- Supabase Edge Functions settings
- Admin panel hosting platform

### 2. Deploy Edge Functions
Functions are automatically deployed:
- `whatsapp` - Main webhook handler
- `admin-api` - Backoffice operations
- `generate-qr` - QR code generation
- `process-vehicle-ocr` - Document OCR

### 3. Configure Security
- RLS policies enforce data isolation
- Webhook signature verification enabled
- Rate limiting on endpoints
- Secure storage for sensitive documents

### 4. Test Flows
Test each user journey:
```bash
# Send test message
curl -X POST "https://graph.facebook.com/v21.0/YOUR_PHONE_ID/messages" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"PHONE","type":"text","text":{"body":"Hi"}}'
```

## Monitoring

### Logs
- Edge function logs: Supabase Dashboard → Functions → Logs
- WhatsApp logs: Admin panel → Logs
- Error tracking: JSON structured logging

### Metrics
- Message success/failure rates
- Response times
- User engagement
- Conversion rates (quotes → certificates)

## Troubleshooting

### Common Issues

1. **Webhook not receiving messages**:
   - Verify webhook URL and token
   - Check signature verification
   - Review edge function logs

2. **OCR failures**:
   - Ensure OpenAI API key is set
   - Check image quality and format
   - Review process-vehicle-ocr logs

3. **QR generation errors**:
   - Verify storage bucket permissions
   - Check QR generation function logs
   - Ensure proper USSD format

### Debug Mode
Enable detailed logging by adding debug context to functions.

## Security Considerations

- **Webhook Security**: Signature verification prevents spoofing
- **Data Privacy**: RLS ensures users only see their data
- **Storage Security**: Private buckets for sensitive documents
- **API Security**: Service role for backend operations only

## Performance Optimizations

- **Database**: Indexes on frequently queried columns
- **Caching**: Session state cached in database
- **CDN**: Public assets served via Supabase CDN
- **Connection Pooling**: Managed by Supabase

## Scaling

- **Horizontal**: Supabase auto-scales edge functions
- **Database**: Connection pooling and read replicas
- **Storage**: Unlimited with pay-per-use pricing
- **WhatsApp**: Rate limits handled gracefully

## Support

For technical issues:
1. Check edge function logs
2. Review database logs  
3. Monitor WhatsApp webhook logs
4. Check admin panel error messages

For business logic:
1. Review user flow documentation
2. Test with admin panel tools
3. Verify state machine transitions
