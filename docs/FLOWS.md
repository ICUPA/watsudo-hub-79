# WhatsApp Flow State Machine Documentation

## Overview
This document describes the complete state machine for WhatsApp user interactions in the Mobility + USSD QR Hub. The system enforces strict state transitions to ensure consistent user experience and prevent flow corruption.

## State Constants

### Core States
```typescript
const STATES = {
  // Main navigation
  HOME: "HOME",
  MAIN_MENU: "MAIN_MENU",
  
  // Mobility flows
  MOBILITY: "MOBILITY",
  MOBILITY_MENU: "MOBILITY_MENU",
  
  // Nearby Drivers (ND)
  ND: "ND",
  ND_SELECT_TYPE: "ND_SELECT_TYPE",
  ND_WAIT_LOCATION: "ND_WAIT_LOCATION",
  ND_CHOOSE_DRIVER: "ND_CHOOSE_DRIVER",
  ND_BOOKING: "ND_BOOKING",
  ND_CONFIRMED: "ND_CONFIRMED",
  ND_CANCELLED: "ND_CANCELLED",
  
  // Schedule Trip (ST)
  ST: "ST",
  ST_ROLE: "ST_ROLE",
  ST_PASSENGER: "ST_PASSENGER",
  ST_DRIVER: "ST_DRIVER",
  ST_PICKUP: "ST_PICKUP",
  ST_DROPOFF: "ST_DROPOFF",
  ST_TIME: "ST_TIME",
  ST_CONFIRM: "ST_CONFIRM",
  ST_SCHEDULED: "ST_SCHEDULED",
  
  // Add Vehicle (AV)
  AV: "AV",
  AV_USAGE: "AV_USAGE",
  AV_DOC: "AV_DOC",
  AV_PROCESSING: "AV_PROCESSING",
  AV_COMPLETE: "AV_COMPLETE",
  
  // QR Code flows
  QR: "QR",
  QR_MENU: "QR_MENU",
  QR_PHONE: "QR_PHONE",
  QR_CODE: "QR_CODE",
  QR_AMOUNT_MODE: "QR_AMOUNT_MODE",
  QR_AMOUNT_INPUT: "QR_AMOUNT_INPUT",
  QR_GENERATE: "QR_GENERATE",
  QR_COMPLETE: "QR_COMPLETE",
  
  // Insurance flows
  INSURANCE: "INSURANCE",
  INS_CHECK_VEHICLE: "INS_CHECK_VEHICLE",
  INS_COLLECT_DOCS: "INS_COLLECT_DOCS",
  INS_CHOOSE_START: "INS_CHOOSE_START",
  INS_CHOOSE_PERIOD: "INS_CHOOSE_PERIOD",
  INS_CHOOSE_ADDONS: "INS_CHOOSE_ADDONS",
  INS_CHOOSE_PA: "INS_CHOOSE_PA",
  INS_SUMMARY: "INS_SUMMARY",
  INS_QUEUED: "INS_QUEUED",
  INS_DECIDE: "INS_DECIDE",
  INS_PAYMENT_PLAN: "INS_PAYMENT_PLAN",
  INS_AWAIT_PAYMENT: "INS_AWAIT_PAYMENT",
  INS_ISSUED: "INS_ISSUED",
  
  // Post-action states
  QR_AGAIN: "QR_AGAIN",
  QR_CHANGE_DEFAULT: "QR_CHANGE_DEFAULT",
  QR_A_1000: "QR_A_1000",
  QR_A_2000: "QR_A_2000",
  QR_A_5000: "QR_A_5000",
  QR_A_OTHER: "QR_A_OTHER"
} as const;
```

## State Transition Rules

### Valid Transitions Matrix

| Current State | Valid Next States | Required Context |
|---------------|-------------------|------------------|
| `HOME` | `MOBILITY`, `QR`, `INSURANCE` | None |
| `MOBILITY` | `ND`, `ST`, `AV`, `HOME` | None |
| `ND` | `ND_SELECT_TYPE`, `HOME` | None |
| `ND_SELECT_TYPE` | `ND_WAIT_LOCATION`, `HOME` | `vehicle_type` |
| `ND_WAIT_LOCATION` | `ND_CHOOSE_DRIVER`, `HOME` | `location` (lat, lng) |
| `ND_CHOOSE_DRIVER` | `ND_BOOKING`, `HOME` | `selected_driver_id` |
| `ND_BOOKING` | `ND_CONFIRMED`, `ND_CANCELLED` | `ride_id` |
| `ST` | `ST_ROLE`, `HOME` | None |
| `ST_ROLE` | `ST_PASSENGER`, `ST_DRIVER`, `HOME` | `role` |
| `ST_PASSENGER` | `ST_PICKUP`, `HOME` | None |
| `ST_PICKUP` | `ST_DROPOFF`, `HOME` | `pickup_location` |
| `ST_DROPOFF` | `ST_TIME`, `HOME` | `dropoff_location` |
| `ST_TIME` | `ST_CONFIRM`, `HOME` | `scheduled_time` |
| `ST_CONFIRM` | `ST_SCHEDULED`, `HOME` | `confirmation` |
| `AV` | `AV_USAGE`, `HOME` | None |
| `AV_USAGE` | `AV_DOC`, `HOME` | `usage_type` |
| `AV_DOC` | `AV_PROCESSING`, `HOME` | `document_uploaded` |
| `AV_PROCESSING` | `AV_COMPLETE`, `HOME` | `ocr_result` |
| `QR` | `QR_PHONE`, `QR_CODE`, `HOME` | None |
| `QR_PHONE` | `QR_AMOUNT_MODE`, `HOME` | `phone_number` |
| `QR_CODE` | `QR_AMOUNT_MODE`, `HOME` | `momo_code` |
| `QR_AMOUNT_MODE` | `QR_AMOUNT_INPUT`, `QR_GENERATE`, `HOME` | `amount_mode` |
| `QR_AMOUNT_INPUT` | `QR_GENERATE`, `HOME` | `amount_value` |
| `QR_GENERATE` | `QR_COMPLETE`, `HOME` | `qr_generated` |
| `QR_COMPLETE` | `QR_AGAIN`, `QR_CHANGE_DEFAULT`, `HOME` | None |

### Context Requirements

#### Location Context
```typescript
interface LocationContext {
  lat: number;
  lng: number;
  formatted_address?: string;
  place_id?: string;
}
```

#### Vehicle Context
```typescript
interface VehicleContext {
  usage_type: 'moto' | 'cab' | 'liffan' | 'truck' | 'rental';
  plate?: string;
  make?: string;
  model?: string;
  year?: number;
}
```

#### QR Context
```typescript
interface QRContext {
  type: 'phone' | 'code';
  identifier: string;
  amount?: number;
  amount_mode: 'with' | 'without';
}
```

#### Ride Context
```typescript
interface RideContext {
  pickup: LocationContext;
  dropoff: LocationContext;
  scheduled_time?: string;
  vehicle_type: string;
  driver_id?: string;
}
```

## Flow Implementation

### 1. Nearby Drivers Flow (ND)

#### Flow Sequence
1. **User selects ND** → `ND_SELECT_TYPE`
2. **Choose vehicle type** → `ND_WAIT_LOCATION`
3. **Share location** → `ND_CHOOSE_DRIVER`
4. **Select driver** → `ND_BOOKING`
5. **Driver confirms** → `ND_CONFIRMED` or `ND_CANCELLED`

#### Implementation
```typescript
async function handleNearbyDriversFlow(session: any, message: any) {
  switch (session.state) {
    case STATES.ND_SELECT_TYPE:
      if (message.type === 'interactive') {
        const vehicleType = getInteractiveId(message.interactive);
        if (isValidVehicleType(vehicleType)) {
          await setState(session.id, STATES.ND_WAIT_LOCATION, {
            vehicle_type: vehicleType
          });
          await requestLocation(message.from);
        }
      }
      break;
      
    case STATES.ND_WAIT_LOCATION:
      if (message.location) {
        const location = {
          lat: message.location.latitude,
          lng: message.location.longitude
        };
        
        // Find nearby drivers
        const drivers = await findNearbyDrivers(location, 15);
        
        if (drivers.length > 0) {
          await setState(session.id, STATES.ND_CHOOSE_DRIVER, {
            ...session.context,
            location,
            drivers
          });
          await showDriverList(message.from, drivers);
        } else {
          await setState(session.id, STATES.MOBILITY_MENU, {});
          await sendNoDriversMessage(message.from);
        }
      }
      break;
      
    case STATES.ND_CHOOSE_DRIVER:
      if (message.type === 'interactive') {
        const driverId = getInteractiveId(message.interactive);
        if (driverId.startsWith('ND_BOOK_')) {
          const actualDriverId = driverId.replace('ND_BOOK_', '');
          await setState(session.id, STATES.ND_BOOKING, {
            ...session.context,
            selected_driver_id: actualDriverId
          });
          await createRideRequest(message.from, session.context, actualDriverId);
        }
      }
      break;
  }
}
```

### 2. Schedule Trip Flow (ST)

#### Flow Sequence
1. **User selects ST** → `ST_ROLE`
2. **Choose role** → `ST_PASSENGER` or `ST_DRIVER`
3. **Set pickup** → `ST_PICKUP`
4. **Set dropoff** → `ST_DROPOFF`
5. **Set time** → `ST_TIME`
6. **Confirm** → `ST_SCHEDULED`

#### Implementation
```typescript
async function handleScheduleTripFlow(session: any, message: any) {
  switch (session.state) {
    case STATES.ST_ROLE:
      if (message.type === 'interactive') {
        const role = getInteractiveId(message.interactive);
        if (role === 'ST_PASSENGER' || role === 'ST_DRIVER') {
          await setState(session.id, role, { role });
          if (role === 'ST_PASSENGER') {
            await requestPickupLocation(message.from);
          } else {
            await requestDriverAvailability(message.from);
          }
        }
      }
      break;
      
    case STATES.ST_PICKUP:
      if (message.location) {
        const pickup = {
          lat: message.location.latitude,
          lng: message.location.longitude
        };
        await setState(session.id, STATES.ST_DROPOFF, {
          ...session.context,
          pickup
        });
        await requestDropoffLocation(message.from);
      }
      break;
      
    case STATES.ST_DROPOFF:
      if (message.location) {
        const dropoff = {
          lat: message.location.latitude,
          lng: message.location.longitude
        };
        await setState(session.id, STATES.ST_TIME, {
          ...session.context,
          dropoff
        });
        await requestScheduledTime(message.from);
      }
      break;
  }
}
```

### 3. Add Vehicle Flow (AV)

#### Flow Sequence
1. **User selects AV** → `AV_USAGE`
2. **Choose usage type** → `AV_DOC`
3. **Upload document** → `AV_PROCESSING`
4. **OCR processing** → `AV_COMPLETE`

#### Implementation
```typescript
async function handleAddVehicleFlow(session: any, message: any) {
  switch (session.state) {
    case STATES.AV_USAGE:
      if (message.type === 'interactive') {
        const usageType = getInteractiveId(message.interactive);
        if (isValidUsageType(usageType)) {
          await setState(session.id, STATES.AV_DOC, {
            usage_type: usageType
          });
          await requestVehicleDocument(message.from);
        }
      }
      break;
      
    case STATES.AV_DOC:
      if (message.image || message.document) {
        const mediaId = message.image?.id || message.document?.id;
        if (mediaId) {
          await setState(session.id, STATES.AV_PROCESSING, {
            ...session.context,
            document_uploaded: true
          });
          
          // Process OCR
          const result = await processVehicleOCR(mediaId, session.user_id, session.context.usage_type);
          
          if (result.success) {
            await setState(session.id, STATES.AV_COMPLETE, {
              ...session.context,
              ocr_result: result.data
            });
            await sendVehicleSavedMessage(message.from, result.data);
          } else {
            await setState(session.id, STATES.AV_DOC, {});
            await sendOCRErrorMessage(message.from, result.error);
          }
        }
      }
      break;
  }
}
```

### 4. QR Generation Flow

#### Flow Sequence
1. **User selects QR** → `QR_PHONE` or `QR_CODE`
2. **Enter identifier** → `QR_AMOUNT_MODE`
3. **Choose amount mode** → `QR_AMOUNT_INPUT` or `QR_GENERATE`
4. **Enter amount** → `QR_GENERATE`
5. **Generate QR** → `QR_COMPLETE`

#### Implementation
```typescript
async function handleQRFlow(session: any, message: any) {
  switch (session.state) {
    case STATES.QR_PHONE:
      if (message.type === 'text') {
        const phone = normalizePhone(message.text.body);
        if (isValidPhone(phone)) {
          await setState(session.id, STATES.QR_AMOUNT_MODE, {
            type: 'phone',
            phone
          });
          await showAmountModeOptions(message.from);
        } else {
          await sendInvalidPhoneMessage(message.from);
        }
      }
      break;
      
    case STATES.QR_CODE:
      if (message.type === 'text') {
        const code = message.text.body.trim();
        if (isValidMoMoCode(code)) {
          await setState(session.id, STATES.QR_AMOUNT_MODE, {
            type: 'code',
            code
          });
          await showAmountModeOptions(message.from);
        } else {
          await sendInvalidCodeMessage(message.from);
        }
      }
      break;
      
    case STATES.QR_AMOUNT_MODE:
      if (message.type === 'interactive') {
        const amountMode = getInteractiveId(message.interactive);
        if (amountMode === 'QR_AMT_WITH') {
          await setState(session.id, STATES.QR_AMOUNT_INPUT, {
            ...session.context,
            amount_mode: 'with'
          });
          await requestAmountInput(message.from);
        } else if (amountMode === 'QR_AMT_NONE') {
          await setState(session.id, STATES.QR_GENERATE, {
            ...session.context,
            amount_mode: 'without'
          });
          await generateQRCode(message.from, session.context);
        }
      }
      break;
      
    case STATES.QR_AMOUNT_INPUT:
      if (message.type === 'text') {
        const amount = parseFloat(message.text.body);
        if (isValidAmount(amount)) {
          await setState(session.id, STATES.QR_GENERATE, {
            ...session.context,
            amount
          });
          await generateQRCode(message.from, session.context);
        } else {
          await sendInvalidAmountMessage(message.from);
        }
      }
      break;
  }
}
```

## State Validation

### Transition Guards
```typescript
function isValidTransition(currentState: string, nextState: string, context: any): boolean {
  const validTransitions = VALID_TRANSITIONS[currentState] || [];
  
  if (!validTransitions.includes(nextState)) {
    return false;
  }
  
  // Check context requirements
  const requiredContext = CONTEXT_REQUIREMENTS[nextState] || [];
  for (const field of requiredContext) {
    if (!context[field]) {
      return false;
    }
  }
  
  return true;
}
```

### Context Validation
```typescript
function validateContext(state: string, context: any): ValidationResult {
  const requiredFields = CONTEXT_REQUIREMENTS[state] || [];
  const missingFields = [];
  
  for (const field of requiredFields) {
    if (!context[field]) {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      missingFields,
      message: `Missing required fields: ${missingFields.join(', ')}`
    };
  }
  
  return { valid: true };
}
```

## Error Handling

### State Recovery
```typescript
async function recoverFromError(session: any, error: Error) {
  logger.error('State machine error', { sessionId: session.id, error: error.message });
  
  // Try to recover to a safe state
  if (session.context?.last_safe_state) {
    await setState(session.id, session.context.last_safe_state, {});
    await sendRecoveryMessage(session.phone_number);
  } else {
    // Fallback to main menu
    await setState(session.id, STATES.MAIN_MENU, {});
    await sendMainMenu(session.phone_number);
  }
}
```

### User Communication
```typescript
async function sendStateTransitionMessage(phone: string, fromState: string, toState: string) {
  const messages = {
    [STATES.ND_WAIT_LOCATION]: "📍 Please share your current location to find nearby drivers.",
    [STATES.ST_PICKUP]: "📍 Please share your pickup location.",
    [STATES.AV_DOC]: "📄 Please send a photo or document of your vehicle insurance certificate.",
    [STATES.QR_AMOUNT_INPUT]: "💰 Please enter the amount in Rwandan Francs (e.g., 1000)."
  };
  
  const message = messages[toState] || "Please continue with your request.";
  await sendText(phone, message);
}
```

## Testing

### State Machine Tests
```typescript
describe('State Machine', () => {
  test('valid transitions should succeed', () => {
    expect(isValidTransition(STATES.HOME, STATES.MOBILITY, {})).toBe(true);
    expect(isValidTransition(STATES.ND_SELECT_TYPE, STATES.ND_WAIT_LOCATION, { vehicle_type: 'moto' })).toBe(true);
  });
  
  test('invalid transitions should fail', () => {
    expect(isValidTransition(STATES.HOME, STATES.ND_BOOKING, {})).toBe(false);
    expect(isValidTransition(STATES.ND_WAIT_LOCATION, STATES.ND_SELECT_TYPE, {})).toBe(false);
  });
  
  test('context validation should work', () => {
    const result = validateContext(STATES.ND_WAIT_LOCATION, { vehicle_type: 'moto' });
    expect(result.valid).toBe(true);
    
    const invalidResult = validateContext(STATES.ND_WAIT_LOCATION, {});
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.missingFields).toContain('vehicle_type');
  });
});
```

### Flow Integration Tests
```typescript
describe('WhatsApp Flows', () => {
  test('ND flow should complete successfully', async () => {
    const session = await createTestSession(STATES.ND_SELECT_TYPE);
    
    // Simulate vehicle type selection
    await handleNearbyDriversFlow(session, createInteractiveMessage('moto'));
    expect(session.state).toBe(STATES.ND_WAIT_LOCATION);
    
    // Simulate location sharing
    await handleNearbyDriversFlow(session, createLocationMessage(1.9441, 30.0619));
    expect(session.state).toBe(STATES.ND_CHOOSE_DRIVER);
  });
});
```

## Monitoring & Analytics

### State Transition Metrics
```typescript
async function trackStateTransition(fromState: string, toState: string, context: any) {
  await analytics.track('state_transition', {
    from_state: fromState,
    to_state: toState,
    user_id: context.user_id,
    timestamp: new Date().toISOString(),
    context_keys: Object.keys(context)
  });
}
```

### Flow Completion Rates
```typescript
async function trackFlowCompletion(flowType: string, success: boolean, duration: number) {
  await analytics.track('flow_completion', {
    flow_type: flowType,
    success,
    duration_ms: duration,
    timestamp: new Date().toISOString()
  });
}
```

## Conclusion

This state machine ensures consistent user experience across all WhatsApp flows while maintaining data integrity and preventing flow corruption. The strict validation and error recovery mechanisms provide a robust foundation for the user interaction system.

**Key Benefits**:
- **Predictable user experience** with clear state progression
- **Data integrity** through context validation
- **Error recovery** with fallback mechanisms
- **Analytics** for flow optimization
- **Testing** for reliability assurance
