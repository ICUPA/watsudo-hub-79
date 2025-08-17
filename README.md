# Mobility + USSD QR Hub — Production Platform

A production-ready WhatsApp-first platform providing mobility services, insurance quotes, and USSD QR code generation for Rwanda. Built with Supabase, Deno Edge Functions, and Next.js.

## 🚀 Features

### WhatsApp Interface
- **Mobility Services**: Find nearby drivers, schedule trips, add vehicles via OCR
- **Insurance (Moto)**: Document collection, quotation flow, certificate issuance  
- **QR Codes**: Generate USSD QR codes for MoMo payments (phone or merchant code)
- **Interactive UI**: Buttons, lists, location sharing, media uploads

### Production Enhancements
- ✅ **Webhook Security**: Signature verification (HMAC-SHA256)
- ✅ **Error Handling**: Comprehensive error handling with graceful fallbacks
- ✅ **Idempotency**: Prevents duplicate message processing
- ✅ **Retry Logic**: Exponential backoff for transient failures
- ✅ **Logging**: Structured JSON logs with correlation IDs
- ✅ **Validation**: Strict flow ID validation and input sanitization
- ✅ **Performance**: Optimized database indexes and queries
- ✅ **Storage**: Canonical bucket names and secure policies

## 📋 Environment Setup

### Canonical Environment Variables
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# WhatsApp Business API (Canonical)
META_PHONE_NUMBER_ID=your-phone-number-id
META_ACCESS_TOKEN=your-access-token
META_WABA_VERIFY_TOKEN=your-verify-token
META_WABA_APP_SECRET=your-app-secret

# External APIs
OPENAI_API_KEY=your-openai-api-key
TIMEZONE=Africa/Kigali
```

Legacy `WHATSAPP_*` variables are supported as fallbacks.

## 🛠️ Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd mobility-ussd-qr-hub
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

3. **Database Ready**: Migrations have been applied with:
   - Performance indexes on critical tables
   - Canonical storage buckets (`qr`, `vehicle_docs`, `quotes`, `certificates`)
   - RLS policies for data security
   - Optimized functions for nearby drivers

4. **Configure WhatsApp Webhook**
   - URL: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp`
   - Verify token: Your `META_WABA_VERIFY_TOKEN`
   - Subscribe to: `messages`

## 🧪 Testing

```bash
# Frontend tests (Vitest)
npm test

# Edge function tests (Deno)
# deno test --allow-net=false --allow-read=false supabase/functions/**/*.ts

# Linting
npm run lint
deno lint supabase/functions/
```

### Test Flows
1. **QR Generation**: Send "Hi" → QR Codes → Phone → Amount → Receive QR + tel: link
2. **Vehicle OCR**: Mobility → Add Vehicle → Upload insurance cert → Verify extraction
3. **Insurance**: Insurance → Upload docs → Select options → Receive quote

## 📊 Monitoring

- **Health Check**: `GET /functions/v1/whatsapp/health`
- **Logs**: Structured JSON with correlation IDs in `whatsapp_logs` table
- **Admin Panel**: Real-time monitoring of users, vehicles, quotes

## 🔐 Security Features

- **Authentication**: RLS policies on all tables
- **Validation**: Input sanitization and flow ID validation  
- **Storage**: Secure policies for private documents
- **Webhook**: Signature verification prevents spoofing
- **Idempotency**: Duplicate message protection

## 🚀 CI/CD

GitHub Actions pipeline includes:
- Linting and type checking (Deno + ESLint)
- Security scanning
- Unit tests
- Build verification
- Deployment gates

## 📚 Architecture

```
WhatsApp Users ←→ WhatsApp Business API ←→ Edge Functions ←→ PostgreSQL + Storage
                                               ↓
                                         Admin Panel (Next.js)
```

### Key Components
- **Shared Utilities** (`_shared/wa.ts`): Message sending, validation, phone normalization
- **WhatsApp Handler**: Production-ready webhook with retry logic and error handling  
- **OCR Processing**: GPT-4o Vision for document extraction
- **QR Generation**: USSD string building with proper tel: link encoding
- **Storage Layer**: Public QR codes, private documents with signed URLs

## 🐛 Troubleshooting

### Common Issues
- **Messages not sending**: Check Edge Function logs, verify tokens
- **OCR failures**: Verify OpenAI key, check image format
- **Storage issues**: Confirm bucket names, check RLS policies

### Debug Tools
- Correlation IDs in logs for request tracing
- Admin panel WhatsApp conversation viewer
- Health check endpoint for system status

## 📞 Support

1. Check Edge Function logs in Supabase dashboard
2. Review WhatsApp logs in admin panel  
3. Monitor database performance
4. Check GitHub Issues for known problems

---

**Production Status**: ✅ Ready for deployment with comprehensive error handling, security, and monitoring.
