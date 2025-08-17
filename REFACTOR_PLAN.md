# Mobility + USSD QR Hub - Refactor Plan

## Overview
This refactor plan addresses the critical security vulnerabilities and technical debt identified in the audit. The plan is structured in phases to ensure safe, incremental improvements without disrupting existing functionality.

## Phase 1: Critical Security Fixes (24-48 hours) 🚨

### PR-001: Environment Hardening & Secrets Removal
**Priority**: CRITICAL
**Effort**: 4-6 hours
**Risk**: LOW (Configuration changes only)

#### Changes Required
1. **Remove hardcoded secrets** from source code
   - `src/integrations/supabase/client.ts` - Move to env vars
   - `src/lib/storageUrls.ts` - Move to env vars
   - Verify no other hardcoded credentials

2. **Create `.env.example`** with all required variables
   ```
   # Supabase
   SUPABASE_URL=
   SUPABASE_SERVICE_ROLE_KEY=
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   
   # WhatsApp Business API
   META_WABA_ID=
   META_PHONE_NUMBER_ID=
   META_ACCESS_TOKEN=
   META_VERIFY_TOKEN=
   META_APP_SECRET=
   
   # OpenAI
   OPENAI_API_KEY=
   
   # Google Maps
   GOOGLE_MAPS_BROWSER_KEY=
   
   # App Configuration
   TIMEZONE=Africa/Kigali
   NODE_ENV=development
   ```

3. **Update `.gitignore`** to exclude environment files
   ```
   .env
   .env.local
   .env.production
   .env.staging
   ```

4. **Add environment validation** in app startup
   - Verify required variables are present
   - Validate format where applicable
   - Graceful fallbacks for development

#### Files Modified
- `src/integrations/supabase/client.ts`
- `src/lib/storageUrls.ts`
- `.env.example` (new)
- `.gitignore`
- `src/main.tsx` (add env validation)

#### Testing
- [ ] Verify app starts with valid .env
- [ ] Verify app fails gracefully with missing vars
- [ ] Confirm no secrets in source code
- [ ] Test environment variable loading

### PR-002: WhatsApp Security Hardening
**Priority**: CRITICAL
**Effort**: 6-8 hours
**Risk**: MEDIUM (Core functionality changes)

#### Changes Required
1. **Implement signature validation** in WhatsApp webhook
   ```typescript
   // Verify X-Hub-Signature-256
   const signature = req.headers.get('x-hub-signature-256');
   if (!verifySignature(body, signature, META_APP_SECRET)) {
     return new Response('Unauthorized', { status: 401 });
   }
   ```

2. **Add rate limiting** to webhook endpoint
   - Per-phone number limits
   - Global endpoint limits
   - Graceful degradation

3. **Input sanitization** for all user inputs
   - Phone number validation
   - Text content filtering
   - Media type restrictions

4. **Enhanced error handling** with structured logging
   - Correlation IDs for each request
   - Error categorization
   - User-friendly fallback messages

#### Files Modified
- `supabase/functions/whatsapp/index.ts`
- `supabase/functions/_shared/wa.ts`
- Add new utility functions for security

#### Testing
- [ ] Verify signature validation works
- [ ] Test rate limiting behavior
- [ ] Validate input sanitization
- [ ] Confirm error handling improvements

## Phase 2: Core Infrastructure (Week 1)

### PR-003: Database Schema & RLS Verification
**Priority**: HIGH
**Effort**: 8-12 hours
**Risk**: MEDIUM (Database changes)

#### Changes Required
1. **Verify PostGIS extension** is enabled
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

2. **Add missing geo indexes** for performance
   ```sql
   CREATE INDEX CONCURRENTLY idx_drivers_location_gist 
   ON drivers USING GIST (location);
   ```

3. **Verify RLS policies** are working correctly
   - Test cross-user data access prevention
   - Verify admin access policies
   - Test driver directory public access

4. **Add missing constraints** and triggers
   - Vehicle plate uniqueness per user
   - Phone number format validation
   - Timestamp update triggers

#### Files Modified
- New migration file for schema improvements
- RLS policy verification scripts
- Performance testing queries

#### Testing
- [ ] Verify PostGIS functions work
- [ ] Test geo queries performance
- [ ] Confirm RLS isolation works
- [ ] Validate constraint enforcement

### PR-004: State Machine Implementation
**Priority**: HIGH
**Effort**: 12-16 hours
**Risk**: MEDIUM (User flow changes)

#### Changes Required
1. **Implement strict state validation**
   ```typescript
   const VALID_TRANSITIONS = {
     HOME: ['MOBILITY', 'QR', 'INSURANCE'],
     MOBILITY: ['ND', 'ST', 'AV', 'HOME'],
     ND: ['ND_SELECT_TYPE', 'HOME'],
     // ... complete mapping
   };
   ```

2. **Add state transition guards**
   - Prevent illegal transitions
   - Validate required context data
   - Log state changes for debugging

3. **Implement context validation**
   - Required fields per state
   - Data type validation
   - Business rule enforcement

4. **Add state recovery mechanisms**
   - Handle interrupted flows
   - Provide restart options
   - Maintain user progress

#### Files Modified
- `supabase/functions/whatsapp/index.ts`
- New state machine utilities
- State validation functions

#### Testing
- [ ] Test all valid transitions
- [ ] Verify invalid transitions blocked
- [ ] Test context validation
- [ ] Confirm state recovery works

## Phase 3: Admin Panel & UI (Week 2)

### PR-005: Admin Panel Refactoring
**Priority**: MEDIUM
**Effort**: 16-20 hours
**Risk**: LOW (UI improvements)

#### Changes Required
1. **Implement shared Maps picker component**
   ```typescript
   interface PlacePickerProps {
     onPlaceSelect: (place: Place) => void;
     placeholder?: string;
     className?: string;
   }
   ```

2. **Add Google Maps integration**
   - Places Autocomplete
   - Map visualization
   - Draggable markers
   - Coordinate extraction

3. **Improve admin CRUD operations**
   - Inline editing capabilities
   - Bulk operations
   - Advanced filtering
   - Export functionality

4. **Add real-time updates**
   - WebSocket connections
   - Live dashboard updates
   - Notification system

#### Files Modified
- New shared components for Maps
- Admin panel improvements
- Real-time update system

#### Testing
- [ ] Test Maps integration
- [ ] Verify CRUD operations
- [ ] Confirm real-time updates
- [ ] Test responsive design

### PR-006: PWA & Share Target Implementation
**Priority**: MEDIUM
**Effort**: 12-16 hours
**Risk**: LOW (New features)

#### Changes Required
1. **Add PWA manifest** with share target
   ```json
   {
     "share_target": {
       "action": "/share",
       "method": "GET",
       "params": {
         "title": "title",
         "text": "text",
         "url": "url"
       }
     }
   }
   ```

2. **Implement `/share` route**
   - Parse Google Maps links
   - Resolve to Place objects
   - Store in database
   - Redirect to appropriate flow

3. **Add geolocation support**
   - Permission handling
   - Fallback to manual search
   - Coordinate validation

4. **Implement Android Web Share Target**
   - Handle shared content
   - Parse various formats
   - Graceful degradation

#### Files Modified
- `public/manifest.json`
- New share route component
- Geolocation utilities
- PWA service worker

#### Testing
- [ ] Test PWA installation
- [ ] Verify share target works
- [ ] Test geolocation
- [ ] Confirm Android WST support

## Phase 4: Testing & Quality (Week 3)

### PR-007: Testing Infrastructure
**Priority**: HIGH
**Effort**: 20-24 hours
**Risk**: LOW (New tests)

#### Changes Required
1. **Unit test setup**
   - Jest + React Testing Library
   - Test utilities and mocks
   - Coverage reporting

2. **Integration tests**
   - WhatsApp webhook testing
   - OCR flow testing
   - QR generation testing
   - Database operations

3. **E2E tests**
   - Playwright setup
   - User flow testing
   - Cross-browser testing
   - Mobile testing

4. **Test data management**
   - Seed data scripts
   - Test database setup
   - Mock external services

#### Files Modified
- Test configuration files
- Test utilities and helpers
- Test data scripts
- CI configuration

#### Testing
- [ ] Verify test setup works
- [ ] Confirm coverage reporting
- [ ] Test CI pipeline
- [ ] Validate test data

### PR-008: Code Quality & Linting
**Priority**: MEDIUM
**Effort**: 8-12 hours
**Risk**: LOW (Code style)

#### Changes Required
1. **Enhanced ESLint configuration**
   - TypeScript rules
   - React best practices
   - Import organization
   - Accessibility rules

2. **Prettier integration**
   - Code formatting rules
   - Pre-commit hooks
   - Editor configuration

3. **TypeScript strict mode**
   - Enable strict flags
   - Fix type errors
   - Add missing types
   - Improve type safety

4. **Import organization**
   - Absolute path mapping
   - Import sorting
   - Dependency analysis

#### Files Modified
- ESLint configuration
- Prettier configuration
- TypeScript configuration
- Package.json scripts

#### Testing
- [ ] Verify linting works
- [ ] Confirm formatting applied
- [ ] Test TypeScript compilation
- [ ] Validate import organization

## Phase 5: Production Readiness (Week 4)

### PR-009: Monitoring & Observability
**Priority**: HIGH
**Effort**: 16-20 hours
**Risk**: MEDIUM (Infrastructure)

#### Changes Required
1. **Structured logging**
   - JSON log format
   - Correlation IDs
   - Log levels
   - Log aggregation

2. **Metrics collection**
   - Request counts
   - Error rates
   - Performance metrics
   - Business metrics

3. **Health checks**
   - Database connectivity
   - External service status
   - System resources
   - Custom health indicators

4. **Error tracking**
   - Sentry integration
   - Error categorization
   - Alert thresholds
   - Incident response

#### Files Modified
- Logging utilities
- Metrics collection
- Health check endpoints
- Error handling

#### Testing
- [ ] Verify logging works
- [ ] Test metrics collection
- [ ] Confirm health checks
- [ ] Validate error tracking

### PR-010: Performance & Security
**Priority**: MEDIUM
**Effort**: 12-16 hours
**Risk**: LOW (Optimizations)

#### Changes Required
1. **Performance optimization**
   - Database query optimization
   - Frontend bundle optimization
   - Edge function optimization
   - Caching strategies

2. **Security hardening**
   - CORS configuration
   - Security headers
   - Input validation
   - Rate limiting

3. **Deployment optimization**
   - Build optimization
   - Asset optimization
   - CDN configuration
   - Environment-specific configs

#### Files Modified
- Performance optimizations
- Security configurations
- Build configurations
- Deployment scripts

#### Testing
- [ ] Verify performance improvements
- [ ] Test security measures
- [ ] Confirm deployment works
- [ ] Validate optimizations

## Implementation Checklist

### Pre-Implementation
- [ ] Review and approve refactor plan
- [ ] Set up development environment
- [ ] Create feature branches
- [ ] Set up CI/CD pipeline

### Phase 1 (Critical Security)
- [ ] PR-001: Environment hardening
- [ ] PR-002: WhatsApp security
- [ ] Security review and testing
- [ ] Production deployment

### Phase 2 (Core Infrastructure)
- [ ] PR-003: Database improvements
- [ ] PR-004: State machine
- [ ] Integration testing
- [ ] Performance validation

### Phase 3 (Admin & UI)
- [ ] PR-005: Admin improvements
- [ ] PR-006: PWA features
- [ ] UI/UX testing
- [ ] Mobile testing

### Phase 4 (Testing & Quality)
- [ ] PR-007: Testing infrastructure
- [ ] PR-008: Code quality
- [ ] Test coverage validation
- [ ] Quality gates

### Phase 5 (Production)
- [ ] PR-009: Monitoring
- [ ] PR-010: Performance
- [ ] Production testing
- [ ] Go-live preparation

## Risk Mitigation

### Technical Risks
- **Breaking changes**: Comprehensive testing, gradual rollout
- **Performance regression**: Benchmarking, monitoring
- **Security vulnerabilities**: Security review, penetration testing

### Business Risks
- **User experience disruption**: User testing, feedback loops
- **Feature delays**: Agile methodology, MVP approach
- **Data migration issues**: Backup strategies, rollback plans

### Operational Risks
- **Deployment failures**: Blue-green deployment, rollback procedures
- **Monitoring gaps**: Comprehensive observability, alerting
- **Support challenges**: Documentation, training, escalation procedures

## Success Criteria

### Phase 1
- [ ] All hardcoded secrets removed
- [ ] Environment configuration complete
- [ ] WhatsApp security implemented
- [ ] Security audit passed

### Phase 2
- [ ] Database schema optimized
- [ ] State machine implemented
- [ ] Performance benchmarks met
- [ ] RLS policies verified

### Phase 3
- [ ] Admin panel enhanced
- [ ] PWA features working
- [ ] Maps integration complete
- [ ] Share target functional

### Phase 4
- [ ] Test coverage >80%
- [ ] Code quality gates passed
- [ ] CI/CD pipeline working
- [ ] Quality standards met

### Phase 5
- [ ] Monitoring operational
- [ ] Performance optimized
- [ ] Security hardened
- [ ] Production ready

## Timeline Summary

| Phase | Duration | Priority | Risk |
|-------|----------|----------|------|
| 1: Critical Security | 2 days | CRITICAL | LOW |
| 2: Core Infrastructure | 1 week | HIGH | MEDIUM |
| 3: Admin & UI | 1 week | MEDIUM | LOW |
| 4: Testing & Quality | 1 week | HIGH | LOW |
| 5: Production | 1 week | MEDIUM | LOW |

**Total Duration**: 4-5 weeks
**Critical Path**: Phases 1-2 (Security + Infrastructure)

## Next Steps

1. **Immediate**: Review and approve this plan
2. **Day 1**: Start Phase 1 (Critical Security)
3. **Week 1**: Complete security fixes
4. **Week 2**: Begin infrastructure improvements
5. **Ongoing**: Regular progress reviews and adjustments

## Resources Required

- **Development Team**: 2-3 full-stack developers
- **DevOps Support**: 1 DevOps engineer (part-time)
- **Security Review**: 1 security specialist
- **Testing Support**: 1 QA engineer
- **Project Management**: 1 PM (part-time)

## Conclusion

This refactor plan addresses all critical issues identified in the audit while maintaining system stability and user experience. The phased approach ensures safe, incremental improvements with clear success criteria and risk mitigation strategies.

**Key Success Factors**:
- Prioritize security fixes
- Maintain backward compatibility
- Comprehensive testing at each phase
- Regular stakeholder communication
- Continuous monitoring and feedback
