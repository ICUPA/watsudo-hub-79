// WhatsApp Flow Handlers
// Implements the business logic for each WhatsApp flow using the state machine

import { 
  StateMachine, 
  STATES, 
  type StateType, 
  type SessionContext,
  type LocationContext,
  type VehicleContext,
  type QRContext
} from './stateMachine';

export interface WhatsAppMessage {
  from: string;
  type: 'text' | 'interactive' | 'location' | 'image' | 'document';
  text?: { body: string };
  interactive?: { button_reply?: { id: string }; list_reply?: { id: string } };
  location?: { latitude: number; longitude: number };
  image?: { id: string };
  document?: { id: string };
}

export interface FlowHandler {
  handleMessage(message: WhatsAppMessage, session: any): Promise<void>;
  getNextState(currentState: StateType, message: WhatsAppMessage): StateType | null;
}

// Base flow handler class
export abstract class BaseFlowHandler implements FlowHandler {
  protected stateMachine: StateMachine;
  protected logger: (level: string, message: string, context?: any) => void;

  constructor(logger?: (level: string, message: string, context?: any) => void) {
    this.stateMachine = new StateMachine(STATES.HOME, {}, logger);
    this.logger = logger || console.log;
  }

  abstract handleMessage(message: WhatsAppMessage, session: any): Promise<void>;
  abstract getNextState(currentState: StateType, message: WhatsAppMessage): StateType | null;

  protected async updateSessionState(sessionId: string, newState: StateType, context: SessionContext): Promise<void> {
    // This would typically update the database
    this.logger('info', 'Session state updated', { sessionId, newState, context });
  }

  protected async sendMessage(to: string, message: string): Promise<void> {
    // This would typically send via WhatsApp API
    this.logger('info', 'Message sent', { to, message });
  }

  protected async sendButtons(to: string, message: string, buttons: Array<{ id: string; title: string }>): Promise<void> {
    // This would typically send interactive buttons via WhatsApp API
    this.logger('info', 'Buttons sent', { to, message, buttons });
  }

  protected async sendList(to: string, message: string, items: Array<{ id: string; title: string; description?: string }>): Promise<void> {
    // This would typically send interactive list via WhatsApp API
    this.logger('info', 'List sent', { to, message, items });
  }
}

// Nearby Drivers Flow Handler
export class NearbyDriversFlowHandler extends BaseFlowHandler {
  async handleMessage(message: WhatsAppMessage, session: any): Promise<void> {
    const currentState = session.state as StateType;
    
    try {
      switch (currentState) {
        case STATES.ND_SELECT_TYPE:
          await this.handleVehicleTypeSelection(message, session);
          break;
          
        case STATES.ND_WAIT_LOCATION:
          await this.handleLocationSharing(message, session);
          break;
          
        case STATES.ND_CHOOSE_DRIVER:
          await this.handleDriverSelection(message, session);
          break;
          
        case STATES.ND_BOOKING:
          await this.handleBookingConfirmation(message, session);
          break;
          
        default:
          this.logger('warn', 'Unhandled state in ND flow', { currentState, message });
      }
    } catch (error) {
      this.logger('error', 'Error in ND flow', { error: error.message, currentState });
      await this.handleFlowError(message.from, session, error);
    }
  }

  getNextState(currentState: StateType, message: WhatsAppMessage): StateType | null {
    switch (currentState) {
      case STATES.ND_SELECT_TYPE:
        if (message.type === 'interactive' && message.interactive?.button_reply) {
          return STATES.ND_WAIT_LOCATION;
        }
        break;
        
      case STATES.ND_WAIT_LOCATION:
        if (message.type === 'location') {
          return STATES.ND_CHOOSE_DRIVER;
        }
        break;
        
      case STATES.ND_CHOOSE_DRIVER:
        if (message.type === 'interactive' && message.interactive?.list_reply) {
          return STATES.ND_BOOKING;
        }
        break;
        
      case STATES.ND_BOOKING:
        if (message.type === 'interactive' && message.interactive?.button_reply) {
          const buttonId = message.interactive.button_reply.id;
          if (buttonId === 'CONFIRM') return STATES.ND_CONFIRMED;
          if (buttonId === 'CANCEL') return STATES.ND_CANCELLED;
        }
        break;
    }
    
    return null;
  }

  private async handleVehicleTypeSelection(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'interactive' && message.interactive?.button_reply) {
      const vehicleType = message.interactive.button_reply.id;
      
      if (this.isValidVehicleType(vehicleType)) {
        const newState = STATES.ND_WAIT_LOCATION;
        const context = { vehicle_type: vehicleType };
        
        await this.updateSessionState(session.id, newState, context);
        await this.sendMessage(message.from, "📍 Please share your current location to find nearby drivers.");
      } else {
        await this.sendMessage(message.from, "❌ Invalid vehicle type selected. Please try again.");
      }
    }
  }

  private async handleLocationSharing(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'location' && message.location) {
      const location: LocationContext = {
        lat: message.location.latitude,
        lng: message.location.longitude
      };
      
      // Find nearby drivers (this would call the database)
      const drivers = await this.findNearbyDrivers(location, 15);
      
      if (drivers.length > 0) {
        const newState = STATES.ND_CHOOSE_DRIVER;
        const context = { 
          ...session.context, 
          location,
          drivers 
        };
        
        await this.updateSessionState(session.id, newState, context);
        await this.showDriverList(message.from, drivers);
      } else {
        await this.sendMessage(message.from, "😔 No drivers nearby right now. Please try again later.");
        await this.updateSessionState(session.id, STATES.MOBILITY_MENU, {});
      }
    }
  }

  private async handleDriverSelection(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'interactive' && message.interactive?.list_reply) {
      const driverId = message.interactive.list_reply.id;
      
      if (driverId.startsWith('ND_BOOK_')) {
        const actualDriverId = driverId.replace('ND_BOOK_', '');
        const newState = STATES.ND_BOOKING;
        const context = { 
          ...session.context, 
          selected_driver_id: actualDriverId 
        };
        
        await this.updateSessionState(session.id, newState, context);
        await this.createRideRequest(message.from, session.context, actualDriverId);
      }
    }
  }

  private async handleBookingConfirmation(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'interactive' && message.interactive?.button_reply) {
      const buttonId = message.interactive.button_reply.id;
      
      if (buttonId === 'CONFIRM') {
        const newState = STATES.ND_CONFIRMED;
        const context = { ...session.context, confirmation: true };
        
        await this.updateSessionState(session.id, newState, context);
        await this.sendMessage(message.from, "✅ Your ride has been confirmed! The driver will contact you shortly.");
      } else if (buttonId === 'CANCEL') {
        const newState = STATES.ND_CANCELLED;
        const context = { ...session.context, confirmation: false };
        
        await this.updateSessionState(session.id, newState, context);
        await this.sendMessage(message.from, "❌ Your ride has been cancelled.");
      }
    }
  }

  private async findNearbyDrivers(location: LocationContext, radiusKm: number): Promise<any[]> {
    // This would call the Supabase RPC function
    // For now, return mock data
    return [
      { id: 'driver1', name: 'John Driver', rating: 4.8, distance: 0.5 },
      { id: 'driver2', name: 'Jane Driver', rating: 4.9, distance: 1.2 },
      { id: 'driver3', name: 'Bob Driver', rating: 4.7, distance: 2.1 }
    ];
  }

  private async showDriverList(to: string, drivers: any[]): Promise<void> {
    const items = drivers.map((driver, index) => ({
      id: `ND_BOOK_${driver.id}`,
      title: `#${index + 1} ${driver.name}`,
      description: `⭐ ${driver.rating} • ${driver.distance} km away`
    }));
    
    await this.sendList(to, "🚗 Top drivers nearby:", items);
  }

  private async createRideRequest(to: string, context: any, driverId: string): Promise<void> {
    const buttons = [
      { id: 'CONFIRM', title: '✅ Confirm Ride' },
      { id: 'CANCEL', title: '❌ Cancel' }
    ];
    
    await this.sendButtons(to, "📋 Confirm your ride request?", buttons);
  }

  private async handleFlowError(to: string, session: any, error: Error): Promise<void> {
    this.logger('error', 'Flow error handled', { error: error.message, session });
    
    await this.sendMessage(to, "😔 Something went wrong. Please try again or contact support.");
    await this.updateSessionState(session.id, STATES.HOME, {});
  }

  private isValidVehicleType(type: string): boolean {
    return ['moto', 'cab', 'liffan', 'truck', 'rental'].includes(type);
  }
}

// Schedule Trip Flow Handler
export class ScheduleTripFlowHandler extends BaseFlowHandler {
  async handleMessage(message: WhatsAppMessage, session: any): Promise<void> {
    const currentState = session.state as StateType;
    
    try {
      switch (currentState) {
        case STATES.ST_ROLE:
          await this.handleRoleSelection(message, session);
          break;
          
        case STATES.ST_PICKUP:
          await this.handlePickupLocation(message, session);
          break;
          
        case STATES.ST_DROPOFF:
          await this.handleDropoffLocation(message, session);
          break;
          
        case STATES.ST_TIME:
          await this.handleTimeSelection(message, session);
          break;
          
        case STATES.ST_CONFIRM:
          await this.handleTripConfirmation(message, session);
          break;
          
        default:
          this.logger('warn', 'Unhandled state in ST flow', { currentState, message });
      }
    } catch (error) {
      this.logger('error', 'Error in ST flow', { error: error.message, currentState });
      await this.handleFlowError(message.from, session, error);
    }
  }

  getNextState(currentState: StateType, message: WhatsAppMessage): StateType | null {
    switch (currentState) {
      case STATES.ST_ROLE:
        if (message.type === 'interactive' && message.interactive?.button_reply) {
          const role = message.interactive.button_reply.id;
          if (role === 'ST_PASSENGER' || role === 'ST_DRIVER') {
            return STATES.ST_PICKUP;
          }
        }
        break;
        
      case STATES.ST_PICKUP:
        if (message.type === 'location') {
          return STATES.ST_DROPOFF;
        }
        break;
        
      case STATES.ST_DROPOFF:
        if (message.type === 'location') {
          return STATES.ST_TIME;
        }
        break;
        
      case STATES.ST_TIME:
        if (message.type === 'text') {
          return STATES.ST_CONFIRM;
        }
        break;
        
      case STATES.ST_CONFIRM:
        if (message.type === 'interactive' && message.interactive?.button_reply) {
          const buttonId = message.interactive.button_reply.id;
          if (buttonId === 'CONFIRM') return STATES.ST_SCHEDULED;
        }
        break;
    }
    
    return null;
  }

  private async handleRoleSelection(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'interactive' && message.interactive?.button_reply) {
      const role = message.interactive.button_reply.id;
      
      if (role === 'ST_PASSENGER' || role === 'ST_DRIVER') {
        const newState = STATES.ST_PICKUP;
        const context = { role: role === 'ST_PASSENGER' ? 'passenger' : 'driver' };
        
        await this.updateSessionState(session.id, newState, context);
        
        if (role === 'ST_PASSENGER') {
          await this.sendMessage(message.from, "📍 Please share your pickup location.");
        } else {
          await this.sendMessage(message.from, "📍 Please share your starting location.");
        }
      }
    }
  }

  private async handlePickupLocation(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'location' && message.location) {
      const pickup: LocationContext = {
        lat: message.location.latitude,
        lng: message.location.longitude
      };
      
      const newState = STATES.ST_DROPOFF;
      const context = { ...session.context, pickup };
      
      await this.updateSessionState(session.id, newState, context);
      await this.sendMessage(message.from, "📍 Now please share your dropoff location.");
    }
  }

  private async handleDropoffLocation(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'location' && message.location) {
      const dropoff: LocationContext = {
        lat: message.location.latitude,
        lng: message.location.longitude
      };
      
      const newState = STATES.ST_TIME;
      const context = { ...session.context, dropoff };
      
      await this.updateSessionState(session.id, newState, context);
      await this.sendMessage(message.from, "⏰ Please enter your preferred time (e.g., 14:30 or 'in 2 hours').");
    }
  }

  private async handleTimeSelection(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'text' && message.text) {
      const scheduledTime = message.text.body;
      
      const newState = STATES.ST_CONFIRM;
      const context = { ...session.context, scheduled_time: scheduledTime };
      
      await this.updateSessionState(session.id, newState, context);
      await this.showTripSummary(message.from, session.context, scheduledTime);
    }
  }

  private async handleTripConfirmation(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'interactive' && message.interactive?.button_reply) {
      const buttonId = message.interactive.button_reply.id;
      
      if (buttonId === 'CONFIRM') {
        const newState = STATES.ST_SCHEDULED;
        const context = { ...session.context, confirmation: true };
        
        await this.updateSessionState(session.id, newState, context);
        await this.sendMessage(message.from, "✅ Your trip has been scheduled successfully!");
      }
    }
  }

  private async showTripSummary(to: string, context: any, scheduledTime: string): Promise<void> {
    const summary = `📋 Trip Summary:
🚗 Role: ${context.role}
📍 Pickup: ${context.pickup ? 'Location shared' : 'Not set'}
📍 Dropoff: ${context.dropoff ? 'Location shared' : 'Not set'}
⏰ Time: ${scheduledTime}

Please confirm your trip details.`;
    
    const buttons = [
      { id: 'CONFIRM', title: '✅ Confirm Trip' },
      { id: 'CANCEL', title: '❌ Cancel' }
    ];
    
    await this.sendMessage(to, summary);
    await this.sendButtons(to, "Confirm this trip?", buttons);
  }

  private async handleFlowError(to: string, session: any, error: Error): Promise<void> {
    this.logger('error', 'Flow error handled', { error: error.message, session });
    
    await this.sendMessage(to, "😔 Something went wrong. Please try again or contact support.");
    await this.updateSessionState(session.id, STATES.HOME, {});
  }
}

// Add Vehicle Flow Handler
export class AddVehicleFlowHandler extends BaseFlowHandler {
  async handleMessage(message: WhatsAppMessage, session: any): Promise<void> {
    const currentState = session.state as StateType;
    
    try {
      switch (currentState) {
        case STATES.AV_USAGE:
          await this.handleUsageTypeSelection(message, session);
          break;
          
        case STATES.AV_DOC:
          await this.handleDocumentUpload(message, session);
          break;
          
        case STATES.AV_PROCESSING:
          await this.handleOCRProcessing(message, session);
          break;
          
        default:
          this.logger('warn', 'Unhandled state in AV flow', { currentState, message });
      }
    } catch (error) {
      this.logger('error', 'Error in AV flow', { error: error.message, currentState });
      await this.handleFlowError(message.from, session, error);
    }
  }

  getNextState(currentState: StateType, message: WhatsAppMessage): StateType | null {
    switch (currentState) {
      case STATES.AV_USAGE:
        if (message.type === 'interactive' && message.interactive?.button_reply) {
          return STATES.AV_DOC;
        }
        break;
        
      case STATES.AV_DOC:
        if (message.type === 'image' || message.type === 'document') {
          return STATES.AV_PROCESSING;
        }
        break;
        
      case STATES.AV_PROCESSING:
        // This would be set by the OCR processing callback
        return STATES.AV_COMPLETE;
    }
    
    return null;
  }

  private async handleUsageTypeSelection(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'interactive' && message.interactive?.button_reply) {
      const usageType = message.interactive.button_reply.id;
      
      if (this.isValidUsageType(usageType)) {
        const newState = STATES.AV_DOC;
        const context = { usage_type: usageType };
        
        await this.updateSessionState(session.id, newState, context);
        await this.sendMessage(message.from, "📄 Please send a photo or document of your vehicle insurance certificate.");
      } else {
        await this.sendMessage(message.from, "❌ Invalid usage type selected. Please try again.");
      }
    }
  }

  private async handleDocumentUpload(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'image' || message.type === 'document') {
      const mediaId = message.image?.id || message.document?.id;
      
      if (mediaId) {
        const newState = STATES.AV_PROCESSING;
        const context = { ...session.context, document_uploaded: true };
        
        await this.updateSessionState(session.id, newState, context);
        await this.sendMessage(message.from, "⏳ Processing your document... This may take a few moments.");
        
        // Start OCR processing
        await this.processVehicleOCR(mediaId, session.user_id, session.context.usage_type);
      }
    }
  }

  private async handleOCRProcessing(message: WhatsAppMessage, session: any): Promise<void> {
    // This would typically be handled by a callback from the OCR service
    // For now, we'll simulate successful processing
    const newState = STATES.AV_COMPLETE;
    const context = { 
      ...session.context, 
      ocr_result: { plate: 'ABC123', make: 'Toyota', model: 'Corolla' }
    };
    
    await this.updateSessionState(session.id, newState, context);
    await this.sendMessage(message.from, "✅ Vehicle added successfully! Plate: ABC123, Make: Toyota Corolla");
  }

  private async processVehicleOCR(mediaId: string, userId: string, usageType: string): Promise<void> {
    // This would call the OCR edge function
    this.logger('info', 'OCR processing started', { mediaId, userId, usageType });
  }

  private async handleFlowError(to: string, session: any, error: Error): Promise<void> {
    this.logger('error', 'Flow error handled', { error: error.message, session });
    
    await this.sendMessage(to, "😔 Something went wrong. Please try again or contact support.");
    await this.updateSessionState(session.id, STATES.HOME, {});
  }

  private isValidUsageType(type: string): boolean {
    return ['moto', 'cab', 'liffan', 'truck', 'rental'].includes(type);
  }
}

// QR Generation Flow Handler
export class QRGenerationFlowHandler extends BaseFlowHandler {
  async handleMessage(message: WhatsAppMessage, session: any): Promise<void> {
    const currentState = session.state as StateType;
    
    try {
      switch (currentState) {
        case STATES.QR_PHONE:
          await this.handlePhoneInput(message, session);
          break;
          
        case STATES.QR_CODE:
          await this.handleCodeInput(message, session);
          break;
          
        case STATES.QR_AMOUNT_MODE:
          await this.handleAmountModeSelection(message, session);
          break;
          
        case STATES.QR_AMOUNT_INPUT:
          await this.handleAmountInput(message, session);
          break;
          
        case STATES.QR_GENERATE:
          await this.handleQRGeneration(message, session);
          break;
          
        default:
          this.logger('warn', 'Unhandled state in QR flow', { currentState, message });
      }
    } catch (error) {
      this.logger('error', 'Error in QR flow', { error: error.message, currentState });
      await this.handleFlowError(message.from, session, error);
    }
  }

  getNextState(currentState: StateType, message: WhatsAppMessage): StateType | null {
    switch (currentState) {
      case STATES.QR_PHONE:
        if (message.type === 'text') {
          return STATES.QR_AMOUNT_MODE;
        }
        break;
        
      case STATES.QR_CODE:
        if (message.type === 'text') {
          return STATES.QR_AMOUNT_MODE;
        }
        break;
        
      case STATES.QR_AMOUNT_MODE:
        if (message.type === 'interactive' && message.interactive?.button_reply) {
          const mode = message.interactive.button_reply.id;
          if (mode === 'QR_AMT_WITH') return STATES.QR_AMOUNT_INPUT;
          if (mode === 'QR_AMT_NONE') return STATES.QR_GENERATE;
        }
        break;
        
      case STATES.QR_AMOUNT_INPUT:
        if (message.type === 'text') {
          return STATES.QR_GENERATE;
        }
        break;
        
      case STATES.QR_GENERATE:
        return STATES.QR_COMPLETE;
    }
    
    return null;
  }

  private async handlePhoneInput(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'text' && message.text) {
      const phone = this.normalizePhone(message.text.body);
      
      if (this.isValidPhone(phone)) {
        const newState = STATES.QR_AMOUNT_MODE;
        const context = { type: 'phone', identifier: phone };
        
        await this.updateSessionState(session.id, newState, context);
        await this.showAmountModeOptions(message.from);
      } else {
        await this.sendMessage(message.from, "❌ Invalid phone number. Please enter a valid Rwandan phone number.");
      }
    }
  }

  private async handleCodeInput(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'text' && message.text) {
      const code = message.text.body.trim();
      
      if (this.isValidMoMoCode(code)) {
        const newState = STATES.QR_AMOUNT_MODE;
        const context = { type: 'code', identifier: code };
        
        await this.updateSessionState(session.id, newState, context);
        await this.showAmountModeOptions(message.from);
      } else {
        await this.sendMessage(message.from, "❌ Invalid MoMo code. Please enter a 4-9 digit code.");
      }
    }
  }

  private async handleAmountModeSelection(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'interactive' && message.interactive?.button_reply) {
      const mode = message.interactive.button_reply.id;
      
      if (mode === 'QR_AMT_WITH') {
        const newState = STATES.QR_AMOUNT_INPUT;
        const context = { ...session.context, amount_mode: 'with' };
        
        await this.updateSessionState(session.id, newState, context);
        await this.sendMessage(message.from, "💰 Please enter the amount in Rwandan Francs (e.g., 1000).");
      } else if (mode === 'QR_AMT_NONE') {
        const newState = STATES.QR_GENERATE;
        const context = { ...session.context, amount_mode: 'without' };
        
        await this.updateSessionState(session.id, newState, context);
        await this.generateQRCode(message.from, context);
      }
    }
  }

  private async handleAmountInput(message: WhatsAppMessage, session: any): Promise<void> {
    if (message.type === 'text' && message.text) {
      const amount = parseFloat(message.text.body);
      
      if (this.isValidAmount(amount)) {
        const newState = STATES.QR_GENERATE;
        const context = { ...session.context, amount };
        
        await this.updateSessionState(session.id, newState, context);
        await this.generateQRCode(message.from, context);
      } else {
        await this.sendMessage(message.from, "❌ Invalid amount. Please enter a valid number greater than 0.");
      }
    }
  }

  private async handleQRGeneration(message: WhatsAppMessage, session: any): Promise<void> {
    // This would typically be handled by the QR generation service
    const newState = STATES.QR_COMPLETE;
    const context = { ...session.context, qr_generated: true };
    
    await this.updateSessionState(session.id, newState, context);
    await this.sendQRCode(message.from, context);
  }

  private async showAmountModeOptions(to: string): Promise<void> {
    const buttons = [
      { id: 'QR_AMT_WITH', title: '💰 With Amount' },
      { id: 'QR_AMT_NONE', title: '🔳 No Amount' }
    ];
    
    await this.sendButtons(to, "💰 Do you want to include an amount in the QR code?", buttons);
  }

  private async generateQRCode(to: string, context: QRContext): Promise<void> {
    await this.sendMessage(to, "🔳 Generating your QR code...");
    
    // This would call the QR generation service
    this.logger('info', 'QR generation started', { context });
  }

  private async sendQRCode(to: string, context: QRContext): Promise<void> {
    const ussd = this.buildUSSD(context.type, context.identifier, context.amount);
    const tel = this.buildTelLink(ussd);
    
    await this.sendMessage(to, `✅ QR Code Generated!
🔳 USSD: ${ussd}
📞 Tap to dial: ${tel}`);
    
    const buttons = [
      { id: 'QR_AGAIN', title: '🔄 Generate Another' },
      { id: 'QR_CHANGE_DEFAULT', title: '⚙️ Change Default' },
      { id: 'HOME', title: '🏠 Home' }
    ];
    
    await this.sendButtons(to, "What would you like to do next?", buttons);
  }

  private async handleFlowError(to: string, session: any, error: Error): Promise<void> {
    this.logger('error', 'Flow error handled', { error: error.message, session });
    
    await this.sendMessage(to, "😔 Something went wrong. Please try again or contact support.");
    await this.updateSessionState(session.id, STATES.HOME, {});
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    
    if (digits.startsWith('250')) {
      return '0' + digits.slice(3);
    }
    
    if (digits.startsWith('+250')) {
      return '0' + digits.slice(4);
    }
    
    return digits.startsWith('0') ? digits : '0' + digits;
  }

  private isValidPhone(phone: string): boolean {
    return /^0[0-9]{9}$/.test(phone);
  }

  private isValidMoMoCode(code: string): boolean {
    return /^\d{4,9}$/.test(code);
  }

  private isValidAmount(amount: number): boolean {
    return !isNaN(amount) && amount > 0;
  }

  private buildUSSD(type: string, identifier: string, amount?: number): string {
    if (type === 'phone') {
      return amount ? `*182*1*1*${identifier}*${amount}#` : `*182*1*1*${identifier}#`;
    } else {
      return amount ? `*182*8*1*${identifier}*${amount}#` : `*182*8*1*${identifier}#`;
    }
  }

  private buildTelLink(ussd: string): string {
    // Encode # as %23 for tel: links
    return `tel:${ussd.replace(/#/g, '%23')}`;
  }
}

// Flow handler factory
export class FlowHandlerFactory {
  static createHandler(flowType: string): FlowHandler {
    switch (flowType) {
      case 'nearby_drivers':
        return new NearbyDriversFlowHandler();
      case 'schedule_trip':
        return new ScheduleTripFlowHandler();
      case 'add_vehicle':
        return new AddVehicleFlowHandler();
      case 'qr_generation':
        return new QRGenerationFlowHandler();
      default:
        throw new Error(`Unknown flow type: ${flowType}`);
    }
  }
}
