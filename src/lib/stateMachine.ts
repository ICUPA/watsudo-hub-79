// WhatsApp Flow State Machine
// Provides strict state validation and transition guards for consistent user experience

export const STATES = {
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

export type StateType = typeof STATES[keyof typeof STATES];

// Valid state transitions matrix
export const VALID_TRANSITIONS: Record<StateType, StateType[]> = {
  [STATES.HOME]: [STATES.MOBILITY, STATES.QR, STATES.INSURANCE],
  [STATES.MAIN_MENU]: [STATES.MOBILITY, STATES.QR, STATES.INSURANCE],
  
  [STATES.MOBILITY]: [STATES.ND, STATES.ST, STATES.AV, STATES.HOME],
  [STATES.MOBILITY_MENU]: [STATES.ND, STATES.ST, STATES.AV, STATES.HOME],
  
  [STATES.ND]: [STATES.ND_SELECT_TYPE, STATES.HOME],
  [STATES.ND_SELECT_TYPE]: [STATES.ND_WAIT_LOCATION, STATES.HOME],
  [STATES.ND_WAIT_LOCATION]: [STATES.ND_CHOOSE_DRIVER, STATES.HOME],
  [STATES.ND_CHOOSE_DRIVER]: [STATES.ND_BOOKING, STATES.HOME],
  [STATES.ND_BOOKING]: [STATES.ND_CONFIRMED, STATES.ND_CANCELLED, STATES.HOME],
  [STATES.ND_CONFIRMED]: [STATES.HOME],
  [STATES.ND_CANCELLED]: [STATES.HOME],
  
  [STATES.ST]: [STATES.ST_ROLE, STATES.HOME],
  [STATES.ST_ROLE]: [STATES.ST_PASSENGER, STATES.ST_DRIVER, STATES.HOME],
  [STATES.ST_PASSENGER]: [STATES.ST_PICKUP, STATES.HOME],
  [STATES.ST_DRIVER]: [STATES.ST_PICKUP, STATES.HOME],
  [STATES.ST_PICKUP]: [STATES.ST_DROPOFF, STATES.HOME],
  [STATES.ST_DROPOFF]: [STATES.ST_TIME, STATES.HOME],
  [STATES.ST_TIME]: [STATES.ST_CONFIRM, STATES.HOME],
  [STATES.ST_CONFIRM]: [STATES.ST_SCHEDULED, STATES.HOME],
  [STATES.ST_SCHEDULED]: [STATES.HOME],
  
  [STATES.AV]: [STATES.AV_USAGE, STATES.HOME],
  [STATES.AV_USAGE]: [STATES.AV_DOC, STATES.HOME],
  [STATES.AV_DOC]: [STATES.AV_PROCESSING, STATES.HOME],
  [STATES.AV_PROCESSING]: [STATES.AV_COMPLETE, STATES.HOME],
  [STATES.AV_COMPLETE]: [STATES.HOME],
  
  [STATES.QR]: [STATES.QR_PHONE, STATES.QR_CODE, STATES.HOME],
  [STATES.QR_MENU]: [STATES.QR_PHONE, STATES.QR_CODE, STATES.HOME],
  [STATES.QR_PHONE]: [STATES.QR_AMOUNT_MODE, STATES.HOME],
  [STATES.QR_CODE]: [STATES.QR_AMOUNT_MODE, STATES.HOME],
  [STATES.QR_AMOUNT_MODE]: [STATES.QR_AMOUNT_INPUT, STATES.QR_GENERATE, STATES.HOME],
  [STATES.QR_AMOUNT_INPUT]: [STATES.QR_GENERATE, STATES.HOME],
  [STATES.QR_GENERATE]: [STATES.QR_COMPLETE, STATES.HOME],
  [STATES.QR_COMPLETE]: [STATES.QR_AGAIN, STATES.QR_CHANGE_DEFAULT, STATES.HOME],
  
  [STATES.INSURANCE]: [STATES.INS_CHECK_VEHICLE, STATES.HOME],
  [STATES.INS_CHECK_VEHICLE]: [STATES.INS_COLLECT_DOCS, STATES.HOME],
  [STATES.INS_COLLECT_DOCS]: [STATES.INS_CHOOSE_START, STATES.HOME],
  [STATES.INS_CHOOSE_START]: [STATES.INS_CHOOSE_PERIOD, STATES.HOME],
  [STATES.INS_CHOOSE_PERIOD]: [STATES.INS_CHOOSE_ADDONS, STATES.HOME],
  [STATES.INS_CHOOSE_ADDONS]: [STATES.INS_CHOOSE_PA, STATES.INS_SUMMARY, STATES.HOME],
  [STATES.INS_CHOOSE_PA]: [STATES.INS_SUMMARY, STATES.HOME],
  [STATES.INS_SUMMARY]: [STATES.INS_QUEUED, STATES.HOME],
  [STATES.INS_QUEUED]: [STATES.INS_DECIDE, STATES.HOME],
  [STATES.INS_DECIDE]: [STATES.INS_PAYMENT_PLAN, STATES.HOME],
  [STATES.INS_PAYMENT_PLAN]: [STATES.INS_AWAIT_PAYMENT, STATES.HOME],
  [STATES.INS_AWAIT_PAYMENT]: [STATES.INS_ISSUED, STATES.HOME],
  [STATES.INS_ISSUED]: [STATES.HOME],
  
  [STATES.QR_AGAIN]: [STATES.QR_PHONE, STATES.QR_CODE, STATES.HOME],
  [STATES.QR_CHANGE_DEFAULT]: [STATES.QR_PHONE, STATES.QR_CODE, STATES.HOME],
  [STATES.QR_A_1000]: [STATES.QR_GENERATE, STATES.HOME],
  [STATES.QR_A_2000]: [STATES.QR_GENERATE, STATES.HOME],
  [STATES.QR_A_5000]: [STATES.QR_GENERATE, STATES.HOME],
  [STATES.QR_A_OTHER]: [STATES.QR_AMOUNT_INPUT, STATES.HOME]
};

// Context requirements for each state
export const CONTEXT_REQUIREMENTS: Record<StateType, string[]> = {
  [STATES.HOME]: [],
  [STATES.MAIN_MENU]: [],
  
  [STATES.MOBILITY]: [],
  [STATES.MOBILITY_MENU]: [],
  
  [STATES.ND]: [],
  [STATES.ND_SELECT_TYPE]: [],
  [STATES.ND_WAIT_LOCATION]: ['vehicle_type'],
  [STATES.ND_CHOOSE_DRIVER]: ['vehicle_type', 'location'],
  [STATES.ND_BOOKING]: ['vehicle_type', 'location', 'selected_driver_id'],
  [STATES.ND_CONFIRMED]: ['vehicle_type', 'location', 'selected_driver_id', 'ride_id'],
  [STATES.ND_CANCELLED]: ['vehicle_type', 'location', 'selected_driver_id', 'ride_id'],
  
  [STATES.ST]: [],
  [STATES.ST_ROLE]: [],
  [STATES.ST_PASSENGER]: ['role'],
  [STATES.ST_DRIVER]: ['role'],
  [STATES.ST_PICKUP]: ['role'],
  [STATES.ST_DROPOFF]: ['role', 'pickup'],
  [STATES.ST_TIME]: ['role', 'pickup', 'dropoff'],
  [STATES.ST_CONFIRM]: ['role', 'pickup', 'dropoff', 'scheduled_time'],
  [STATES.ST_SCHEDULED]: ['role', 'pickup', 'dropoff', 'scheduled_time', 'confirmation'],
  
  [STATES.AV]: [],
  [STATES.AV_USAGE]: [],
  [STATES.AV_DOC]: ['usage_type'],
  [STATES.AV_PROCESSING]: ['usage_type', 'document_uploaded'],
  [STATES.AV_COMPLETE]: ['usage_type', 'document_uploaded', 'ocr_result'],
  
  [STATES.QR]: [],
  [STATES.QR_MENU]: [],
  [STATES.QR_PHONE]: [],
  [STATES.QR_CODE]: [],
  [STATES.QR_AMOUNT_MODE]: ['type', 'identifier'],
  [STATES.QR_AMOUNT_INPUT]: ['type', 'identifier', 'amount_mode'],
  [STATES.QR_GENERATE]: ['type', 'identifier', 'amount_mode'],
  [STATES.QR_COMPLETE]: ['type', 'identifier', 'amount_mode', 'qr_generated'],
  
  [STATES.INSURANCE]: [],
  [STATES.INS_CHECK_VEHICLE]: [],
  [STATES.INS_COLLECT_DOCS]: [],
  [STATES.INS_CHOOSE_START]: [],
  [STATES.INS_CHOOSE_PERIOD]: ['start_date'],
  [STATES.INS_CHOOSE_ADDONS]: ['start_date', 'period'],
  [STATES.INS_CHOOSE_PA]: ['start_date', 'period', 'addons'],
  [STATES.INS_SUMMARY]: ['start_date', 'period', 'addons'],
  [STATES.INS_QUEUED]: ['start_date', 'period', 'addons'],
  [STATES.INS_DECIDE]: ['start_date', 'period', 'addons'],
  [STATES.INS_PAYMENT_PLAN]: ['start_date', 'period', 'addons'],
  [STATES.INS_AWAIT_PAYMENT]: ['start_date', 'period', 'addons', 'payment_plan'],
  [STATES.INS_ISSUED]: ['start_date', 'period', 'addons', 'payment_plan'],
  
  [STATES.QR_AGAIN]: [],
  [STATES.QR_CHANGE_DEFAULT]: [],
  [STATES.QR_A_1000]: ['type', 'identifier'],
  [STATES.QR_A_2000]: ['type', 'identifier'],
  [STATES.QR_A_5000]: ['type', 'identifier'],
  [STATES.QR_A_OTHER]: ['type', 'identifier']
};

// Context interfaces
export interface LocationContext {
  lat: number;
  lng: number;
  formatted_address?: string;
  place_id?: string;
}

export interface VehicleContext {
  usage_type: 'moto' | 'cab' | 'liffan' | 'truck' | 'rental';
  plate?: string;
  make?: string;
  model?: string;
  year?: number;
}

export interface QRContext {
  type: 'phone' | 'code';
  identifier: string;
  amount?: number;
  amount_mode: 'with' | 'without';
}

export interface RideContext {
  pickup: LocationContext;
  dropoff: LocationContext;
  scheduled_time?: string;
  vehicle_type: string;
  driver_id?: string;
}

export interface SessionContext {
  vehicle_type?: string;
  location?: LocationContext;
  selected_driver_id?: string;
  ride_id?: string;
  role?: 'passenger' | 'driver';
  pickup?: LocationContext;
  dropoff?: LocationContext;
  scheduled_time?: string;
  confirmation?: boolean;
  usage_type?: string;
  document_uploaded?: boolean;
  ocr_result?: any;
  type?: string;
  identifier?: string;
  amount_mode?: string;
  qr_generated?: boolean;
  start_date?: string;
  period?: string;
  addons?: string[];
  payment_plan?: string;
  last_safe_state?: StateType;
}

// Validation result interface
export interface ValidationResult {
  valid: boolean;
  missingFields?: string[];
  message?: string;
}

// State machine class
export class StateMachine {
  private currentState: StateType;
  private context: SessionContext;
  private logger: (level: string, message: string, context?: any) => void;

  constructor(
    initialState: StateType = STATES.HOME,
    initialContext: SessionContext = {},
    logger?: (level: string, message: string, context?: any) => void
  ) {
    this.currentState = initialState;
    this.context = { ...initialContext };
    this.logger = logger || console.log;
  }

  // Get current state
  getCurrentState(): StateType {
    return this.currentState;
  }

  // Get current context
  getContext(): SessionContext {
    return { ...this.context };
  }

  // Validate state transition
  isValidTransition(toState: StateType): boolean {
    const validTransitions = VALID_TRANSITIONS[this.currentState] || [];
    return validTransitions.includes(toState);
  }

  // Validate context for a state
  validateContext(state: StateType): ValidationResult {
    const requiredFields = CONTEXT_REQUIREMENTS[state] || [];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!this.context[field as keyof SessionContext]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return {
        valid: false,
        missingFields,
        message: `Missing required fields for state ${state}: ${missingFields.join(', ')}`
      };
    }

    return { valid: true };
  }

  // Transition to new state
  async transitionTo(
    newState: StateType, 
    contextUpdates: Partial<SessionContext> = {}
  ): Promise<boolean> {
    // Validate transition
    if (!this.isValidTransition(newState)) {
      this.logger('error', 'Invalid state transition', {
        from: this.currentState,
        to: newState,
        validTransitions: VALID_TRANSITIONS[this.currentState]
      });
      return false;
    }

    // Store last safe state for recovery before updating context
    if (this.isSafeState(this.currentState)) {
      this.context.last_safe_state = this.currentState;
    }

    // Update context
    this.context = { ...this.context, ...contextUpdates };

    // Validate context for new state
    const validation = this.validateContext(newState);
    if (!validation.valid) {
      this.logger('error', 'Context validation failed', {
        state: newState,
        missingFields: validation.missingFields,
        context: this.context
      });
      return false;
    }

    // Log transition
    this.logger('info', 'State transition', {
      from: this.currentState,
      to: newState,
      contextKeys: Object.keys(this.context)
    });

    // Update state
    this.currentState = newState;
    return true;
  }

  // Check if state is safe for recovery
  private isSafeState(state: StateType): boolean {
    const safeStates = [
      STATES.HOME,
      STATES.MAIN_MENU,
      STATES.MOBILITY,
      STATES.MOBILITY_MENU,
      STATES.QR_MENU
    ];
    return safeStates.includes(state);
  }

  // Force transition (for error recovery)
  async forceTransition(
    newState: StateType, 
    contextUpdates: Partial<SessionContext> = {}
  ): Promise<void> {
    this.logger('warn', 'Forced state transition', {
      from: this.currentState,
      to: newState,
      reason: 'Error recovery'
    });

    this.context = { ...this.context, ...contextUpdates };
    this.currentState = newState;
  }

  // Reset to safe state
  async resetToSafeState(): Promise<void> {
    const safeState = this.context.last_safe_state || STATES.HOME;
    
    this.logger('info', 'Resetting to safe state', {
      from: this.currentState,
      to: safeState
    });

    await this.forceTransition(safeState, {});
  }

  // Get available transitions from current state
  getAvailableTransitions(): StateType[] {
    return VALID_TRANSITIONS[this.currentState] || [];
  }

  // Check if state is terminal (no further transitions)
  isTerminalState(state: StateType): boolean {
    const transitions = VALID_TRANSITIONS[state] || [];
    return transitions.length === 0 || transitions.every(t => t === STATES.HOME);
  }

  // Get flow type for current state
  getFlowType(): string {
    if (this.currentState.startsWith('ND')) return 'nearby_drivers';
    if (this.currentState.startsWith('ST')) return 'schedule_trip';
    if (this.currentState.startsWith('AV')) return 'add_vehicle';
    if (this.currentState.startsWith('QR')) return 'qr_generation';
    if (this.currentState.startsWith('INS')) return 'insurance';
    return 'main_menu';
  }

  // Export state for persistence
  exportState(): { state: StateType; context: SessionContext } {
    return {
      state: this.currentState,
      context: { ...this.context }
    };
  }

  // Import state from persistence
  importState(state: StateType, context: SessionContext): void {
    this.currentState = state;
    this.context = { ...context };
    
    this.logger('info', 'State imported', {
      state: this.currentState,
      contextKeys: Object.keys(this.context)
    });
  }
}

// Utility functions
export function isValidState(state: string): state is StateType {
  return Object.values(STATES).includes(state as StateType);
}

export function getStateDisplayName(state: StateType): string {
  const displayNames: Record<StateType, string> = {
    [STATES.HOME]: '🏠 Home',
    [STATES.MAIN_MENU]: '📱 Main Menu',
    [STATES.MOBILITY]: '🚗 Mobility',
    [STATES.MOBILITY_MENU]: '🚗 Mobility Menu',
    [STATES.ND]: '📍 Nearby Drivers',
    [STATES.ND_SELECT_TYPE]: '🚗 Select Vehicle Type',
    [STATES.ND_WAIT_LOCATION]: '📍 Share Location',
    [STATES.ND_CHOOSE_DRIVER]: '👤 Choose Driver',
    [STATES.ND_BOOKING]: '📋 Booking',
    [STATES.ND_CONFIRMED]: '✅ Confirmed',
    [STATES.ND_CANCELLED]: '❌ Cancelled',
    [STATES.ST]: '⏰ Schedule Trip',
    [STATES.ST_ROLE]: '👤 Select Role',
    [STATES.ST_PASSENGER]: '👤 Passenger',
    [STATES.ST_DRIVER]: '🚗 Driver',
    [STATES.ST_PICKUP]: '📍 Pickup Location',
    [STATES.ST_DROPOFF]: '📍 Dropoff Location',
    [STATES.ST_TIME]: '⏰ Schedule Time',
    [STATES.ST_CONFIRM]: '✅ Confirm Trip',
    [STATES.ST_SCHEDULED]: '📅 Trip Scheduled',
    [STATES.AV]: '🚗 Add Vehicle',
    [STATES.AV_USAGE]: '🚗 Vehicle Usage',
    [STATES.AV_DOC]: '📄 Upload Document',
    [STATES.AV_PROCESSING]: '⏳ Processing',
    [STATES.AV_COMPLETE]: '✅ Vehicle Added',
    [STATES.QR]: '🔳 QR Codes',
    [STATES.QR_MENU]: '🔳 QR Menu',
    [STATES.QR_PHONE]: '📱 Phone Number',
    [STATES.QR_CODE]: '🔢 MoMo Code',
    [STATES.QR_AMOUNT_MODE]: '💰 Amount Mode',
    [STATES.QR_AMOUNT_INPUT]: '💰 Enter Amount',
    [STATES.QR_GENERATE]: '🔳 Generate QR',
    [STATES.QR_COMPLETE]: '✅ QR Generated',
    [STATES.INSURANCE]: '🛡️ Insurance',
    [STATES.INS_CHECK_VEHICLE]: '🚗 Check Vehicle',
    [STATES.INS_COLLECT_DOCS]: '📄 Collect Documents',
    [STATES.INS_CHOOSE_START]: '📅 Start Date',
    [STATES.INS_CHOOSE_PERIOD]: '⏰ Period',
    [STATES.INS_CHOOSE_ADDONS]: '➕ Add-ons',
    [STATES.INS_CHOOSE_PA]: '🛡️ Personal Accident',
    [STATES.INS_SUMMARY]: '📋 Summary',
    [STATES.INS_QUEUED]: '⏳ Queued',
    [STATES.INS_DECIDE]: '🤔 Decide',
    [STATES.INS_PAYMENT_PLAN]: '💳 Payment Plan',
    [STATES.INS_AWAIT_PAYMENT]: '⏳ Awaiting Payment',
    [STATES.INS_ISSUED]: '✅ Policy Issued',
    [STATES.QR_AGAIN]: '🔄 Generate Another',
    [STATES.QR_CHANGE_DEFAULT]: '⚙️ Change Default',
    [STATES.QR_A_1000]: '💰 1,000 RWF',
    [STATES.QR_A_2000]: '💰 2,000 RWF',
    [STATES.QR_A_5000]: '💰 5,000 RWF',
    [STATES.QR_A_OTHER]: '💰 Other Amount'
  };
  
  return displayNames[state] || state;
}

export function getStateDescription(state: StateType): string {
  const descriptions: Record<StateType, string> = {
    [STATES.HOME]: 'Welcome to the Mobility + USSD QR Hub',
    [STATES.MAIN_MENU]: 'Choose a service to get started',
    [STATES.MOBILITY]: 'Transportation and vehicle services',
    [STATES.MOBILITY_MENU]: 'Select a mobility service',
    [STATES.ND]: 'Find nearby drivers for immediate pickup',
    [STATES.ND_SELECT_TYPE]: 'Choose your preferred vehicle type',
    [STATES.ND_WAIT_LOCATION]: 'Share your current location to find nearby drivers',
    [STATES.ND_CHOOSE_DRIVER]: 'Select from available drivers',
    [STATES.ND_BOOKING]: 'Confirming your ride booking',
    [STATES.ND_CONFIRMED]: 'Your ride has been confirmed',
    [STATES.ND_CANCELLED]: 'Your ride has been cancelled',
    [STATES.ST]: 'Schedule a trip for later',
    [STATES.ST_ROLE]: 'Choose whether you are a passenger or driver',
    [STATES.ST_PASSENGER]: 'Schedule a trip as a passenger',
    [STATES.ST_DRIVER]: 'Publish your availability as a driver',
    [STATES.ST_PICKUP]: 'Set your pickup location',
    [STATES.ST_DROPOFF]: 'Set your dropoff location',
    [STATES.ST_TIME]: 'Choose your preferred time',
    [STATES.ST_CONFIRM]: 'Review and confirm your trip details',
    [STATES.ST_SCHEDULED]: 'Your trip has been scheduled',
    [STATES.AV]: 'Add a new vehicle to your profile',
    [STATES.AV_USAGE]: 'Select how you will use this vehicle',
    [STATES.AV_DOC]: 'Upload your vehicle insurance certificate',
    [STATES.AV_PROCESSING]: 'Processing your vehicle document',
    [STATES.AV_COMPLETE]: 'Vehicle has been added successfully',
    [STATES.QR]: 'Generate USSD QR codes for payments',
    [STATES.QR_MENU]: 'Choose QR code type and options',
    [STATES.QR_PHONE]: 'Enter phone number for QR code',
    [STATES.QR_CODE]: 'Enter MoMo code for QR code',
    [STATES.QR_AMOUNT_MODE]: 'Choose whether to include amount',
    [STATES.QR_AMOUNT_INPUT]: 'Enter the payment amount',
    [STATES.QR_GENERATE]: 'Generating your QR code',
    [STATES.QR_COMPLETE]: 'QR code generated successfully',
    [STATES.INSURANCE]: 'Motorcycle insurance services',
    [STATES.INS_CHECK_VEHICLE]: 'Verify your vehicle details',
    [STATES.INS_COLLECT_DOCS]: 'Provide required documents',
    [STATES.INS_CHOOSE_START]: 'Select policy start date',
    [STATES.INS_CHOOSE_PERIOD]: 'Choose policy duration',
    [STATES.INS_CHOOSE_ADDONS]: 'Select additional coverage',
    [STATES.INS_CHOOSE_PA]: 'Choose personal accident coverage',
    [STATES.INS_SUMMARY]: 'Review your insurance quote',
    [STATES.INS_QUEUED]: 'Your quote is being processed',
    [STATES.INS_DECIDE]: 'Make decision on insurance',
    [STATES.INS_PAYMENT_PLAN]: 'Choose payment option',
    [STATES.INS_AWAIT_PAYMENT]: 'Waiting for payment confirmation',
    [STATES.INS_ISSUED]: 'Insurance policy issued',
    [STATES.QR_AGAIN]: 'Generate another QR code',
    [STATES.QR_CHANGE_DEFAULT]: 'Modify your default settings',
    [STATES.QR_A_1000]: 'Quick amount: 1,000 RWF',
    [STATES.QR_A_2000]: 'Quick amount: 2,000 RWF',
    [STATES.QR_A_5000]: 'Quick amount: 5,000 RWF',
    [STATES.QR_A_OTHER]: 'Enter custom amount'
  };
  
  return descriptions[state] || 'No description available';
}
