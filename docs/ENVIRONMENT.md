# Environment Configuration Guide - Mobility + USSD QR Hub

## Overview

This document provides comprehensive guidance on configuring the environment for the Mobility + USSD QR Hub across different deployment stages (development, staging, and production).

**Last Updated**: January 16, 2025  
**Version**: 1.0.0  

## 🌍 Environment Types

### **Development Environment**
- **Purpose**: Local development and testing
- **Database**: Local Supabase instance or development project
- **Features**: Full debugging, verbose logging, mock services
- **Access**: Development team only

### **Staging Environment**
- **Purpose**: Pre-production testing and validation
- **Database**: Staging Supabase project
- **Features**: Production-like configuration, limited external services
- **Access**: QA team and stakeholders

### **Production Environment**
- **Purpose**: Live production system
- **Database**: Production Supabase project
- **Features**: Optimized performance, minimal logging, full external services
- **Access**: End users and production support team

## 🔧 Core Configuration

### **Environment Indicator**

```bash
# Required: Environment type indicator
APP_ENV=development|staging|production
NODE_ENV=development|staging|production
```

**Usage**: Used throughout the application to adjust behavior, logging levels, and feature availability.

### **Timezone Configuration**

```bash
# Required: Application timezone
TIMEZONE=Africa/Kigali
```

**Purpose**: Ensures all date/time operations use the correct timezone for Rwanda.

## 🗄️ Supabase Configuration

### **Required Variables**

```bash
# Supabase project URL
SUPABASE_URL=https://your-project.supabase.co

# Service role key for admin operations
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Public keys for client-side operations
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### **Configuration by Environment**

| Environment | Database | Features | Logging |
|-------------|----------|----------|---------|
| **Development** | Local/Dev | Full features | Verbose |
| **Staging** | Staging | Production features | Info |
| **Production** | Production | Production features | Error only |

## 📱 WhatsApp Business API Configuration

### **Required Variables**

```bash
# WhatsApp Business Account ID
META_WABA_ID=your-waba-id

# Phone number ID for sending messages
META_PHONE_NUMBER_ID=your-phone-number-id

# Access token for API calls
META_ACCESS_TOKEN=your-access-token

# Webhook verification token
META_WABA_VERIFY_TOKEN=your-verify-token

# App secret for signature validation
META_WABA_APP_SECRET=your-app-secret
```

### **Legacy Support (Deprecated)**

```bash
# Legacy variables (deprecated but supported)
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_VERIFY_TOKEN=your-verify-token
WHATSAPP_APP_SECRET=your-app-secret
```

**Note**: Legacy variables are supported for backward compatibility but should be migrated to `META_*` variables.

### **Environment-Specific Settings**

| Environment | Webhook URL | Verification | Logging |
|-------------|-------------|--------------|---------|
| **Development** | Local/Dev | Required | Verbose |
| **Staging** | Staging | Required | Info |
| **Production** | Production | Required | Error only |

## 🤖 OpenAI Configuration

### **Required Variables**

```bash
# OpenAI API key for GPT-4o Vision OCR
OPENAI_API_KEY=your-openai-api-key
```

### **Configuration by Environment**

| Environment | API Key | Model | Rate Limits | Logging |
|-------------|---------|-------|-------------|---------|
| **Development** | Dev key | gpt-4o-mini | Standard | Verbose |
| **Staging** | Staging key | gpt-4o | Standard | Info |
| **Production** | Production key | gpt-4o | High | Error only |

## 🗺️ Google Maps Configuration

### **Required Variables**

```bash
# Google Maps JavaScript API key
GOOGLE_MAPS_BROWSER_KEY=your-google-maps-key
```

### **Configuration by Environment**

| Environment | API Key | Quota | Features | Logging |
|-------------|---------|-------|----------|---------|
| **Development** | Dev key | Low | Basic | Verbose |
| **Staging** | Staging key | Medium | Full | Info |
| **Production** | Production key | High | Full | Error only |

## 📊 Monitoring & Observability

### **Optional Variables**

```bash
# Sentry DSN for error tracking (optional)
SENTRY_DSN=your-sentry-dsn

# Log level configuration
LOG_LEVEL=debug|info|warn|error

# Rate limiting configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **Environment-Specific Logging**

| Environment | Log Level | Sentry | Rate Limiting |
|-------------|-----------|--------|---------------|
| **Development** | debug | Disabled | Relaxed |
| **Staging** | info | Staging | Standard |
| **Production** | error | Production | Strict |

## 🔒 Security Configuration

### **Security Variables**

```bash
# CORS configuration
CORS_ORIGIN=*|https://yourdomain.com

# Rate limiting security
SECURITY_RATE_LIMIT_ENABLED=true
SECURITY_MAX_REQUESTS_PER_MINUTE=100

# Session configuration
SESSION_SECRET=your-session-secret
SESSION_MAX_AGE=86400000
```

### **Environment-Specific Security**

| Environment | CORS | Rate Limiting | Session | Debug |
|-------------|------|----------------|---------|-------|
| **Development** | * | Relaxed | Short | Enabled |
| **Staging** | Limited | Standard | Standard | Limited |
| **Production** | Strict | Strict | Long | Disabled |

## 🚀 Performance Configuration

### **Performance Variables**

```bash
# Database connection pooling
DB_POOL_SIZE=10
DB_POOL_TIMEOUT=30000

# Edge function configuration
FUNCTION_TIMEOUT_MS=30000
FUNCTION_MEMORY_MB=512

# Caching configuration
CACHE_TTL_SECONDS=3600
CACHE_MAX_SIZE=1000
```

### **Environment-Specific Performance**

| Environment | Pool Size | Timeout | Memory | Caching |
|-------------|-----------|---------|--------|---------|
| **Development** | 5 | 60s | 256MB | Disabled |
| **Staging** | 10 | 30s | 512MB | Basic |
| **Production** | 20 | 30s | 1024MB | Full |

## 📱 PWA Configuration

### **PWA Variables**

```bash
# PWA configuration
PWA_ENABLED=true
PWA_OFFLINE_ENABLED=true
PWA_UPDATE_ENABLED=true

# Service worker configuration
SW_CACHE_NAME=watsudo-hub-v1
SW_CACHE_STRATEGY=network-first
```

### **Environment-Specific PWA**

| Environment | PWA | Offline | Updates | Caching |
|-------------|-----|---------|---------|---------|
| **Development** | Enabled | Basic | Manual | Minimal |
| **Staging** | Enabled | Full | Auto | Standard |
| **Production** | Enabled | Full | Auto | Aggressive |

## 🔧 Feature Flags

### **Feature Configuration**

```bash
# Feature flags
FEATURE_OCR_ENABLED=true
FEATURE_NEARBY_DRIVERS_ENABLED=true
FEATURE_QR_GENERATION_ENABLED=true
FEATURE_WHATSAPP_ENABLED=true

# Advanced features
FEATURE_ADVANCED_MAPS_ENABLED=false
FEATURE_OFFLINE_SUPPORT_ENABLED=false
FEATURE_REAL_TIME_UPDATES_ENABLED=false
```

### **Environment-Specific Features**

| Environment | Core Features | Advanced Features | Experimental |
|-------------|---------------|-------------------|--------------|
| **Development** | All enabled | All enabled | All enabled |
| **Staging** | All enabled | Limited | Limited |
| **Production** | All enabled | Disabled | Disabled |

## 📋 Environment Setup Checklist

### **Development Environment**

- [ ] **Local Supabase**: Local instance or development project
- [ ] **Environment Variables**: All required variables set
- [ ] **External Services**: Development API keys configured
- [ ] **Logging**: Verbose logging enabled
- [ ] **Debug Mode**: Full debugging capabilities
- [ ] **Mock Services**: Optional mock service configuration

### **Staging Environment**

- [ ] **Staging Supabase**: Dedicated staging project
- [ ] **Environment Variables**: Production-like configuration
- [ ] **External Services**: Staging API keys configured
- [ ] **Logging**: Info-level logging
- [ ] **Testing**: Full testing capabilities
- [ ] **Performance**: Performance monitoring enabled

### **Production Environment**

- [ ] **Production Supabase**: Production project
- [ ] **Environment Variables**: Production configuration
- [ ] **External Services**: Production API keys configured
- [ ] **Logging**: Error-level logging only
- [ ] **Monitoring**: Full monitoring and alerting
- [ ] **Security**: All security measures enabled

## 🔍 Environment Validation

### **Validation Script**

```bash
#!/bin/bash
# validate-env.sh

echo "Validating environment configuration..."

# Check required variables
required_vars=(
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "META_PHONE_NUMBER_ID"
  "META_ACCESS_TOKEN"
  "META_WABA_VERIFY_TOKEN"
  "META_APP_SECRET"
  "OPENAI_API_KEY"
  "GOOGLE_MAPS_BROWSER_KEY"
  "APP_ENV"
  "TIMEZONE"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required variable: $var"
    exit 1
  else
    echo "✅ $var is set"
  fi
done

echo "✅ Environment validation completed successfully"
```

### **Health Check Validation**

```bash
# Test health endpoints
curl -f https://your-project.supabase.co/functions/v1/health_monitor/health
curl -f https://your-project.supabase.co/functions/v1/whatsapp/health

# Test database connection
supabase db diff

# Test function deployment
supabase functions list
```

## 🚨 Troubleshooting

### **Common Issues**

| Issue | Cause | Solution |
|-------|-------|----------|
| **Missing Variables** | Environment not configured | Set all required variables |
| **API Key Errors** | Invalid or expired keys | Rotate API keys |
| **Database Connection** | Invalid Supabase URL/key | Verify Supabase configuration |
| **Webhook Failures** | Invalid verification token | Check Meta configuration |
| **Rate Limiting** | Exceeded API quotas | Increase limits or optimize usage |

### **Debug Commands**

```bash
# Check environment variables
env | grep -E "(SUPABASE|META|OPENAI|GOOGLE)"

# Check Supabase status
supabase status

# Check function logs
supabase functions logs whatsapp --follow

# Test database connection
supabase db diff
```

## 📚 Configuration Examples

### **Development Environment**

```bash
# .env.development
APP_ENV=development
NODE_ENV=development
TIMEZONE=Africa/Kigali

SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=dev-service-key
NEXT_PUBLIC_SUPABASE_URL=https://dev-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dev-anon-key

META_PHONE_NUMBER_ID=dev-phone-id
META_ACCESS_TOKEN=dev-access-token
META_WABA_VERIFY_TOKEN=dev-verify-token
META_APP_SECRET=dev-app-secret

OPENAI_API_KEY=dev-openai-key
GOOGLE_MAPS_BROWSER_KEY=dev-maps-key

LOG_LEVEL=debug
RATE_LIMIT_MAX_REQUESTS=1000
```

### **Staging Environment**

```bash
# .env.staging
APP_ENV=staging
NODE_ENV=staging
TIMEZONE=Africa/Kigali

SUPABASE_URL=https://staging-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=staging-service-key
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=staging-anon-key

META_PHONE_NUMBER_ID=staging-phone-id
META_ACCESS_TOKEN=staging-access-token
META_WABA_VERIFY_TOKEN=staging-verify-token
META_APP_SECRET=staging-app-secret

OPENAI_API_KEY=staging-openai-key
GOOGLE_MAPS_BROWSER_KEY=staging-maps-key

LOG_LEVEL=info
RATE_LIMIT_MAX_REQUESTS=500
SENTRY_DSN=staging-sentry-dsn
```

### **Production Environment**

```bash
# .env.production
APP_ENV=production
NODE_ENV=production
TIMEZONE=Africa/Kigali

SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=prod-service-key
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=prod-anon-key

META_PHONE_NUMBER_ID=prod-phone-id
META_ACCESS_TOKEN=prod-access-token
META_WABA_VERIFY_TOKEN=prod-verify-token
META_APP_SECRET=prod-app-secret

OPENAI_API_KEY=prod-openai-key
GOOGLE_MAPS_BROWSER_KEY=prod-maps-key

LOG_LEVEL=error
RATE_LIMIT_MAX_REQUESTS=100
SENTRY_DSN=prod-sentry-dsn
CORS_ORIGIN=https://watsudo-hub.com
```

## 🔄 Environment Migration

### **Migration Steps**

1. **Backup Current Configuration**
   ```bash
   cp .env .env.backup
   ```

2. **Update Environment Variables**
   ```bash
   # Update variables for new environment
   sed -i 's/development/staging/g' .env
   ```

3. **Validate Configuration**
   ```bash
   ./validate-env.sh
   ```

4. **Test Configuration**
   ```bash
   # Test all endpoints and services
   npm run test:env
   ```

5. **Deploy Changes**
   ```bash
   supabase db push
   supabase functions deploy
   ```

## 📊 Environment Monitoring

### **Health Metrics**

| Metric | Development | Staging | Production |
|--------|-------------|---------|------------|
| **Uptime** | 95% | 98% | 99.9% |
| **Response Time** | < 5s | < 3s | < 2s |
| **Error Rate** | < 5% | < 1% | < 0.1% |
| **Logging Level** | Debug | Info | Error |

### **Monitoring Tools**

- **Supabase Dashboard**: Database and function monitoring
- **Health Endpoints**: System health checks
- **Log Aggregation**: Centralized logging
- **Metrics Collection**: Performance metrics
- **Alerting**: Automated alerting system

## 🎯 Best Practices

### **Configuration Management**

- **Version Control**: Never commit sensitive configuration
- **Environment Separation**: Clear separation between environments
- **Secret Rotation**: Regular secret rotation
- **Configuration Validation**: Automated validation
- **Documentation**: Keep configuration documented

### **Security Considerations**

- **Least Privilege**: Minimal required access
- **Secret Management**: Secure secret storage
- **Access Control**: Proper access controls
- **Monitoring**: Security monitoring enabled
- **Audit Logging**: Comprehensive audit trails

## 🎉 Conclusion

Proper environment configuration is crucial for the successful deployment and operation of the Mobility + USSD QR Hub. Follow the guidelines in this document to ensure secure, reliable, and performant operation across all environments.

**Next Steps**:
1. Configure environment variables for your target environment
2. Validate configuration using provided scripts
3. Test all functionality in the target environment
4. Deploy to production following deployment checklist

**Support**: Contact the development team for assistance with environment configuration.
