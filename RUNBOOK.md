# Mobility + USSD QR Hub - Operations Runbook

## Overview
This runbook provides operational procedures, troubleshooting guides, and incident response protocols for the Mobility + USSD QR Hub system.

## System Architecture

### Components
- **Frontend**: React + Vite + TypeScript (Port 3000)
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: PostgreSQL + PostGIS
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth
- **External APIs**: WhatsApp Business API, OpenAI GPT-4o Vision

### Key Services
1. **WhatsApp Webhook** (`/functions/v1/whatsapp`) - **CRITICAL PATH**
2. **OCR Processing** (`/functions/v1/process-vehicle-ocr`)
3. **OCR Worker** (`/functions/v1/ocr_worker`) - **NEW: Async OCR processing**
4. **QR Generation** (`/functions/v1/generate-qr`)
5. **Nearby Drivers** (`/functions/v1/nearby-drivers`)
6. **Admin API** (`/functions/v1/admin-api`)

## WhatsApp Webhook Troubleshooting

### Critical Issues & Fixes Applied

#### 1. Path-Restricted Verification (FIXED)
**Problem**: Webhook only accepted verification on `/` path, but Supabase Edge Functions receive requests on `/<function-name>`
**Fix**: Updated verification to accept requests on any path
**Status**: ✅ RESOLVED

#### 2. Blocking OCR Processing (FIXED)
**Problem**: Media uploads blocked webhook response for 10+ seconds, causing Meta timeouts
**Fix**: Implemented fast-ack pattern with async OCR processing
**Status**: ✅ RESOLVED

#### 3. Missing Text Message Fallback (FIXED)
**Problem**: Plain text messages in unknown states didn't get responses
**Fix**: Added fallback handler that shows main menu for any unhandled text
**Status**: ✅ RESOLVED

#### 4. Incomplete Message Processing (FIXED)
**Problem**: Only processed first message in webhook payload
**Fix**: Updated to process ALL entries, changes, and messages
**Status**: ✅ RESOLVED

### Webhook Verification Steps

#### Step 1: Verify Environment Variables
```bash
# Check if these are set in your Supabase project
META_PHONE_NUMBER_ID=your-phone-number-id
META_ACCESS_TOKEN=your-access-token
META_WABA_VERIFY_TOKEN=your-verify-token
META_WABA_APP_SECRET=your-app-secret
```

#### Step 2: Test Webhook Endpoint
```bash
# Test the webhook endpoint directly
curl -X GET "https://your-project.supabase.co/functions/v1/whatsapp/health"
# Should return: {"status":"healthy","timestamp":"...","version":"1.0.0"}

# Test webhook verification (replace with your actual values)
curl -X GET "https://your-project.supabase.co/functions/v1/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
# Should return: test123
```

#### Step 3: Verify in Meta Developer Dashboard
1. Go to [Meta Developer Dashboard](https://developers.facebook.com/)
2. Navigate to your WhatsApp Business App
3. Go to **Webhooks** section
4. Check **Recent Deliveries** tab
5. Look for:
   - ✅ Green checkmarks (successful deliveries)
   - ❌ Red X marks (failed deliveries)
   - Response times under 8 seconds
   - HTTP 200 status codes

#### Step 4: Test Message Flow
1. Send "hello" from a WhatsApp number
2. Should receive main menu buttons within 2-3 seconds
3. Tap buttons should trigger appropriate responses
4. Send image/PDF should get "✅ Received your document. Processing..." immediately

### Common Error Codes & Resolutions

#### Meta API Errors
- **400 Bad Request**: Check message payload format
- **401 Unauthorized**: Verify access token is valid and not expired
- **403 Forbidden**: Check app permissions and phone number subscription
- **429 Rate Limited**: Reduce message frequency, implement backoff

#### Webhook Errors
- **404 Not Found**: Check function deployment and URL
- **500 Internal Error**: Check Supabase logs for function errors
- **Timeout (>8s)**: Implement fast-ack pattern, move heavy processing to background

#### Database Errors
- **Connection Failed**: Check Supabase project status
- **Permission Denied**: Verify RLS policies and service role key
- **Table Not Found**: Run database migrations

### Logging & Observability

#### Database Logs
```sql
-- Check recent WhatsApp logs
SELECT 
  created_at,
  direction,
  phone_number,
  message_type,
  status,
  message_id
FROM whatsapp_logs 
ORDER BY created_at DESC 
LIMIT 50;

-- Check for failed outbound messages
SELECT * FROM whatsapp_logs 
WHERE direction = 'out' AND status = 'failed'
ORDER BY created_at DESC;

-- Check OCR job status
SELECT 
  id,
  user_id,
  status,
  attempts,
  error_message,
  created_at
FROM vehicle_ocr_jobs 
ORDER BY created_at DESC;
```

#### Supabase Function Logs
```bash
# View function logs in Supabase dashboard
# Dashboard > Functions > whatsapp > Logs

# Or via CLI (if available)
supabase functions logs whatsapp --follow
```

#### WhatsApp API Response Logging
All outbound WhatsApp API calls are logged with:
- Request payload
- Response status
- Response body
- Correlation ID for tracing

### Health Checks

#### Frontend Health
```bash
# Check if frontend is responding
curl -f http://localhost:3000/ || echo "Frontend down"

# Check environment variables
curl -f http://localhost:3000/api/health || echo "Health check failed"
```

#### Backend Health
```bash
# Check Supabase functions
curl -f "https://your-project.supabase.co/functions/v1/whatsapp/health" || echo "Functions down"

# Check database connectivity
curl -f "https://your-project.supabase.co/rest/v1/health_check" || echo "Database down"
```

#### WhatsApp API Health
```bash
# Check webhook endpoint
curl -X POST "https://your-project.supabase.co/functions/v1/whatsapp" \
  -H "Content-Type: application/json" \
  -d '{"test": "health"}' || echo "Webhook down"
```

### Monitoring & Alerts

#### Key Metrics to Monitor
1. **Response Times**
   - Frontend: < 2s
   - API calls: < 5s
   - Database queries: < 1s
   - **WhatsApp webhook: < 8s (CRITICAL)**

2. **Error Rates**
   - 4xx errors: < 5%
   - 5xx errors: < 1%
   - WhatsApp API errors: < 2%

3. **Business Metrics**
   - Active users per day
   - QR codes generated per hour
   - Rides booked per day
   - OCR success rate

#### Alert Thresholds
- **Critical**: 5xx errors > 5%, WhatsApp down > 5min
- **Warning**: Response time > 10s, 4xx errors > 10%

### Incident Response

#### WhatsApp Webhook Down
1. **Immediate Actions**
   - Check Supabase function status
   - Verify environment variables
   - Test webhook endpoint manually
   - Check Meta Developer Dashboard

2. **Escalation**
   - If function deployment issue: Redeploy functions
   - If environment issue: Update environment variables
   - If Meta API issue: Check Meta status page

3. **Recovery**
   - Verify webhook verification succeeds
   - Test message flow with real device
   - Monitor logs for 24 hours

#### OCR Processing Issues
1. **Check OCR Worker**
```bash
   curl -X GET "https://your-project.supabase.co/functions/v1/ocr_worker"
   ```

2. **Check Job Queue**
```sql
   SELECT status, COUNT(*) FROM vehicle_ocr_jobs GROUP BY status;
   ```

3. **Manual Job Processing**
```bash
   curl -X POST "https://your-project.supabase.co/functions/v1/ocr_worker" \
     -H "Content-Type: application/json" \
     -d '{"job_id": "specific-job-id"}'
   ```

### Performance Optimization

#### Database Indexes
```sql
-- Critical indexes for WhatsApp performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_message_id ON whatsapp_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone_direction ON whatsapp_logs(phone_number, direction);
CREATE INDEX IF NOT EXISTS idx_vehicle_ocr_jobs_pending ON vehicle_ocr_jobs(status, created_at) WHERE status = 'pending';
```

#### Function Optimization
- **Fast-ack pattern**: Return 200 immediately, process in background
- **Batch processing**: Process multiple OCR jobs per worker run
- **Connection pooling**: Reuse Supabase client connections
- **Error handling**: Graceful degradation, never throw unhandled exceptions

### Testing & Validation

#### Manual Testing Checklist
- [ ] Webhook verification succeeds on any path
- [ ] Plain text "hello" returns main menu within 3s
- [ ] Interactive buttons trigger correct responses
- [ ] Media upload returns immediate "Processing..." message
- [ ] OCR completion sends WhatsApp notification
- [ ] No 4xx/5xx responses in Meta dashboard
- [ ] All messages logged to database

#### Automated Testing
```bash
# Run test suite
npm run test

# Run E2E tests
npm run test:e2e

# Test webhook with fixtures
curl -X POST "https://your-project.supabase.co/functions/v1/whatsapp" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=test" \
  -d @test/fixtures/text-message.json
```

### Deployment & Updates

#### Function Deployment
```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy whatsapp

# Check deployment status
supabase status
```

#### Environment Updates
1. Update environment variables in Supabase dashboard
2. Redeploy affected functions
3. Test webhook verification
4. Monitor logs for errors

#### Rollback Procedure
1. Identify previous working version
2. Redeploy from git history
3. Verify webhook functionality
4. Update environment if needed

## Emergency Contacts

- **Primary On-Call**: [Your Name] - [Phone/Email]
- **Secondary**: [Backup Name] - [Phone/Email]
- **Meta Support**: [Meta Business Support Contact]
- **Supabase Support**: [Supabase Support Contact]

## Post-Incident Review

After resolving any WhatsApp webhook incident:
1. Document root cause and resolution
2. Update this runbook with new procedures
3. Implement preventive measures
4. Schedule follow-up review meeting
5. Update monitoring and alerting thresholds
