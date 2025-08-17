import { describe, it, expect, beforeEach } from 'vitest';
import { 
  StateMachine, 
  STATES, 
  type StateType,
  isValidState,
  getStateDisplayName,
  getStateDescription,
  VALID_TRANSITIONS,
  CONTEXT_REQUIREMENTS
} from '../stateMachine';

describe('State Machine', () => {
  let stateMachine: StateMachine;

  beforeEach(() => {
    stateMachine = new StateMachine();
  });

  describe('State Constants', () => {
    it('should have all required states defined', () => {
      const requiredStates = [
        'HOME', 'MAIN_MENU', 'MOBILITY', 'MOBILITY_MENU',
        'ND', 'ND_SELECT_TYPE', 'ND_WAIT_LOCATION', 'ND_CHOOSE_DRIVER',
        'ST', 'ST_ROLE', 'ST_PASSENGER', 'ST_DRIVER',
        'AV', 'AV_USAGE', 'AV_DOC', 'AV_PROCESSING', 'AV_COMPLETE',
        'QR', 'QR_MENU', 'QR_PHONE', 'QR_CODE', 'QR_AMOUNT_MODE',
        'INSURANCE', 'INS_CHECK_VEHICLE', 'INS_COLLECT_DOCS'
      ];

      requiredStates.forEach(state => {
        expect(STATES).toHaveProperty(state);
        expect(typeof STATES[state as keyof typeof STATES]).toBe('string');
      });
    });

    it('should have unique state values', () => {
      const stateValues = Object.values(STATES);
      const uniqueValues = new Set(stateValues);
      expect(stateValues.length).toBe(uniqueValues.size);
    });
  });

  describe('State Validation', () => {
    it('should validate valid states', () => {
      expect(isValidState('HOME')).toBe(true);
      expect(isValidState('ND_SELECT_TYPE')).toBe(true);
      expect(isValidState('QR_AMOUNT_MODE')).toBe(true);
    });

    it('should reject invalid states', () => {
      expect(isValidState('INVALID_STATE')).toBe(false);
      expect(isValidState('')).toBe(false);
      expect(isValidState('home')).toBe(false);
    });
  });

  describe('State Display Names', () => {
    it('should return display names for all states', () => {
      Object.values(STATES).forEach(state => {
        const displayName = getStateDisplayName(state as StateType);
        expect(displayName).toBeDefined();
        expect(displayName).not.toBe(state);
        expect(displayName).toMatch(/^[🏠📱🚗📍👤📋✅❌⏰🛡️📄🔳💰➕🤔💳⏳🔄⚙️]/);
      });
    });

    it('should return fallback for unknown states', () => {
      const displayName = getStateDisplayName('UNKNOWN_STATE' as StateType);
      expect(displayName).toBe('UNKNOWN_STATE');
    });
  });

  describe('State Descriptions', () => {
    it('should return descriptions for all states', () => {
      Object.values(STATES).forEach(state => {
        const description = getStateDescription(state as StateType);
        expect(description).toBeDefined();
        expect(description).not.toBe('');
        expect(description.length).toBeGreaterThan(10);
      });
    });

    it('should return fallback for unknown states', () => {
      const description = getStateDescription('UNKNOWN_STATE' as StateType);
      expect(description).toBe('No description available');
    });
  });

  describe('Valid Transitions', () => {
    it('should have valid transitions for all states', () => {
      Object.values(STATES).forEach(state => {
        const transitions = VALID_TRANSITIONS[state as StateType];
        expect(transitions).toBeDefined();
        expect(Array.isArray(transitions)).toBe(true);
      });
    });

    it('should have HOME as a valid transition from terminal states', () => {
      const terminalStates = [
        STATES.ND_CONFIRMED, STATES.ND_CANCELLED,
        STATES.ST_SCHEDULED, STATES.AV_COMPLETE,
        STATES.QR_COMPLETE, STATES.INS_ISSUED
      ];

      terminalStates.forEach(state => {
        const transitions = VALID_TRANSITIONS[state];
        expect(transitions).toContain(STATES.HOME);
      });
    });

    it('should have logical transition paths', () => {
      // Test ND flow path
      expect(VALID_TRANSITIONS[STATES.ND]).toContain(STATES.ND_SELECT_TYPE);
      expect(VALID_TRANSITIONS[STATES.ND_SELECT_TYPE]).toContain(STATES.ND_WAIT_LOCATION);
      expect(VALID_TRANSITIONS[STATES.ND_WAIT_LOCATION]).toContain(STATES.ND_CHOOSE_DRIVER);
      expect(VALID_TRANSITIONS[STATES.ND_CHOOSE_DRIVER]).toContain(STATES.ND_BOOKING);

      // Test ST flow path
      expect(VALID_TRANSITIONS[STATES.ST]).toContain(STATES.ST_ROLE);
      expect(VALID_TRANSITIONS[STATES.ST_ROLE]).toContain(STATES.ST_PASSENGER);
      expect(VALID_TRANSITIONS[STATES.ST_PASSENGER]).toContain(STATES.ST_PICKUP);
      expect(VALID_TRANSITIONS[STATES.ST_PICKUP]).toContain(STATES.ST_DROPOFF);
    });
  });

  describe('Context Requirements', () => {
    it('should have context requirements for all states', () => {
      Object.values(STATES).forEach(state => {
        const requirements = CONTEXT_REQUIREMENTS[state as StateType];
        expect(requirements).toBeDefined();
        expect(Array.isArray(requirements)).toBe(true);
      });
    });

    it('should have appropriate context requirements for specific states', () => {
      // ND_WAIT_LOCATION requires vehicle_type
      expect(CONTEXT_REQUIREMENTS[STATES.ND_WAIT_LOCATION]).toContain('vehicle_type');
      
      // ND_CHOOSE_DRIVER requires vehicle_type and location
      expect(CONTEXT_REQUIREMENTS[STATES.ND_CHOOSE_DRIVER]).toContain('vehicle_type');
      expect(CONTEXT_REQUIREMENTS[STATES.ND_CHOOSE_DRIVER]).toContain('location');
      
      // ST_DROPOFF requires role and pickup
      expect(CONTEXT_REQUIREMENTS[STATES.ST_DROPOFF]).toContain('role');
      expect(CONTEXT_REQUIREMENTS[STATES.ST_DROPOFF]).toContain('pickup');
      
      // AV_DOC requires usage_type
      expect(CONTEXT_REQUIREMENTS[STATES.AV_DOC]).toContain('usage_type');
    });

    it('should have no requirements for initial states', () => {
      expect(CONTEXT_REQUIREMENTS[STATES.HOME]).toHaveLength(0);
      expect(CONTEXT_REQUIREMENTS[STATES.MAIN_MENU]).toHaveLength(0);
      expect(CONTEXT_REQUIREMENTS[STATES.MOBILITY]).toHaveLength(0);
      expect(CONTEXT_REQUIREMENTS[STATES.QR]).toHaveLength(0);
    });
  });

  describe('State Machine Instance', () => {
    it('should initialize with default state', () => {
      expect(stateMachine.getCurrentState()).toBe(STATES.HOME);
      expect(stateMachine.getContext()).toEqual({});
    });

    it('should initialize with custom state and context', () => {
      const customContext = { user_id: '123', last_action: 'login' };
      const customStateMachine = new StateMachine(STATES.MOBILITY, customContext);
      
      expect(customStateMachine.getCurrentState()).toBe(STATES.MOBILITY);
      expect(customStateMachine.getContext()).toEqual(customContext);
    });

    it('should validate state transitions', () => {
      // Valid transitions
      expect(stateMachine.isValidTransition(STATES.MOBILITY)).toBe(true);
      expect(stateMachine.isValidTransition(STATES.QR)).toBe(true);
      expect(stateMachine.isValidTransition(STATES.INSURANCE)).toBe(true);

      // Invalid transitions
      expect(stateMachine.isValidTransition(STATES.ND_BOOKING)).toBe(false);
      expect(stateMachine.isValidTransition(STATES.ST_CONFIRM)).toBe(false);
      expect(stateMachine.isValidTransition(STATES.AV_PROCESSING)).toBe(false);
    });

    it('should validate context for states', () => {
      // Valid context for ND_WAIT_LOCATION
      const validContext = { vehicle_type: 'moto' };
      const validation = stateMachine['validateContext'](STATES.ND_WAIT_LOCATION);
      expect(validation.valid).toBe(false); // No context set yet
      expect(validation.missingFields).toContain('vehicle_type');

      // Set context and validate again
      stateMachine['context'] = validContext;
      const validation2 = stateMachine['validateContext'](STATES.ND_WAIT_LOCATION);
      expect(validation2.valid).toBe(true);
    });

    it('should transition to valid states', async () => {
      const success = await stateMachine.transitionTo(STATES.MOBILITY);
      expect(success).toBe(true);
      expect(stateMachine.getCurrentState()).toBe(STATES.MOBILITY);
    });

    it('should reject invalid transitions', async () => {
      const success = await stateMachine.transitionTo(STATES.ND_BOOKING);
      expect(success).toBe(false);
      expect(stateMachine.getCurrentState()).toBe(STATES.HOME);
    });

    it('should update context during transitions', async () => {
      const contextUpdates = { vehicle_type: 'moto', user_id: '123' };
      const success = await stateMachine.transitionTo(STATES.MOBILITY, contextUpdates);
      
      expect(success).toBe(true);
      expect(stateMachine.getContext()).toMatchObject(contextUpdates);
    });

    it('should validate context requirements during transitions', async () => {
      // First transition to MOBILITY (valid from HOME)
      await stateMachine.transitionTo(STATES.MOBILITY);
      
      // Then transition to ND (valid from MOBILITY)
      await stateMachine.transitionTo(STATES.ND);
      
      // Then transition to ND_SELECT_TYPE (valid from ND)
      await stateMachine.transitionTo(STATES.ND_SELECT_TYPE);
      
      // Try to transition to ND_WAIT_LOCATION without required context
      const success = await stateMachine.transitionTo(STATES.ND_WAIT_LOCATION);
      expect(success).toBe(false);
      expect(stateMachine.getCurrentState()).toBe(STATES.ND_SELECT_TYPE);

      // Add required context and try again
      const success2 = await stateMachine.transitionTo(STATES.ND_WAIT_LOCATION, { vehicle_type: 'moto' });
      expect(success2).toBe(true);
      expect(stateMachine.getCurrentState()).toBe(STATES.ND_WAIT_LOCATION);
    });

    it('should store last safe state', async () => {
      // HOME is a safe state
      await stateMachine.transitionTo(STATES.MOBILITY);
      expect(stateMachine['context'].last_safe_state).toBe(STATES.HOME);

      // MOBILITY_MENU is also a safe state
      await stateMachine.transitionTo(STATES.ND);
      expect(stateMachine['context'].last_safe_state).toBe(STATES.MOBILITY);
    });

    it('should force transition for error recovery', async () => {
      await stateMachine.forceTransition(STATES.ND_BOOKING, { ride_id: '123' });
      expect(stateMachine.getCurrentState()).toBe(STATES.ND_BOOKING);
      expect(stateMachine.getContext()).toMatchObject({ ride_id: '123' });
    });

    it('should reset to safe state', async () => {
      // Set up a safe state
      await stateMachine.transitionTo(STATES.MOBILITY);
      await stateMachine.transitionTo(STATES.ND);
      
      // Force to an error state
      await stateMachine.forceTransition(STATES.ND_BOOKING);
      
      // Reset to safe state
      await stateMachine.resetToSafeState();
      expect(stateMachine.getCurrentState()).toBe(STATES.MOBILITY);
    });

    it('should get available transitions', () => {
      const transitions = stateMachine.getAvailableTransitions();
      expect(transitions).toContain(STATES.MOBILITY);
      expect(transitions).toContain(STATES.QR);
      expect(transitions).toContain(STATES.INSURANCE);
    });

    it('should identify terminal states', () => {
      expect(stateMachine.isTerminalState(STATES.ND_CONFIRMED)).toBe(true);
      expect(stateMachine.isTerminalState(STATES.ST_SCHEDULED)).toBe(true);
      expect(stateMachine.isTerminalState(STATES.AV_COMPLETE)).toBe(true);
      expect(stateMachine.isTerminalState(STATES.HOME)).toBe(false);
    });

    it('should identify flow types', async () => {
      expect(stateMachine.getFlowType()).toBe('main_menu');
      
      // First transition to MOBILITY (valid from HOME)
      const success1 = await stateMachine.transitionTo(STATES.MOBILITY);
      expect(success1).toBe(true);
      expect(stateMachine.getCurrentState()).toBe(STATES.MOBILITY);
      
      // Then transition to ND (valid from MOBILITY)
      const success2 = await stateMachine.transitionTo(STATES.ND);
      expect(success2).toBe(true);
      expect(stateMachine.getCurrentState()).toBe(STATES.ND);
      expect(stateMachine.getFlowType()).toBe('nearby_drivers');
      
      await stateMachine.forceTransition(STATES.ST);
      expect(stateMachine.getFlowType()).toBe('schedule_trip');
    });

    it('should export and import state', () => {
      const exportedState = stateMachine.exportState();
      expect(exportedState.state).toBe(STATES.HOME);
      expect(exportedState.context).toEqual({});

      // Create new instance and import state
      const newStateMachine = new StateMachine();
      newStateMachine.importState(STATES.MOBILITY, { user_id: '123' });
      
      expect(newStateMachine.getCurrentState()).toBe(STATES.MOBILITY);
      expect(newStateMachine.getContext()).toMatchObject({ user_id: '123' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty context gracefully', () => {
      const validation = stateMachine['validateContext'](STATES.HOME);
      expect(validation.valid).toBe(true);
    });

    it('should handle undefined context fields', () => {
      stateMachine['context'] = { undefined_field: undefined };
      const validation = stateMachine['validateContext'](STATES.ND_WAIT_LOCATION);
      expect(validation.valid).toBe(false);
      expect(validation.missingFields).toContain('vehicle_type');
    });

    it('should handle null context values', () => {
      stateMachine['context'] = { vehicle_type: null };
      const validation = stateMachine['validateContext'](STATES.ND_WAIT_LOCATION);
      expect(validation.valid).toBe(false);
      expect(validation.missingFields).toContain('vehicle_type');
    });

    it('should handle empty string context values', () => {
      stateMachine['context'] = { vehicle_type: '' };
      const validation = stateMachine['validateContext'](STATES.ND_WAIT_LOCATION);
      expect(validation.valid).toBe(false);
      expect(validation.missingFields).toContain('vehicle_type');
    });
  });

  describe('Performance', () => {
    it('should handle large context objects efficiently', () => {
      const largeContext = {
        user_id: '123',
        vehicle_type: 'moto',
        location: { lat: 1.9441, lng: 30.0619 },
        preferences: Array.from({ length: 1000 }, (_, i) => `pref_${i}`),
        metadata: { timestamp: Date.now(), version: '1.0.0' }
      };

      const startTime = performance.now();
      stateMachine['context'] = largeContext;
      const validation = stateMachine['validateContext'](STATES.ND_WAIT_LOCATION);
      const endTime = performance.now();

      expect(validation.valid).toBe(true);
      expect(endTime - startTime).toBeLessThan(10); // Should complete in under 10ms
    });

    it('should handle rapid state transitions', async () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        await stateMachine.transitionTo(STATES.MOBILITY, { iteration: i });
        await stateMachine.transitionTo(STATES.HOME);
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});
