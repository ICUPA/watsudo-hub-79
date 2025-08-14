// Placeholder backend functions - will be replaced with Supabase Edge Functions

export interface VehicleData {
  id?: string;
  plate: string;
  vin?: string;
  make?: string;
  model?: string;
  model_year?: number;
  usage_type: 'moto_taxi' | 'cab' | 'liffan' | 'truck' | 'rental' | 'other';
  owner_phone: string;
  insurance_provider?: string;
  insurance_policy?: string;
  insurance_expiry?: string;
  created_at?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  plate: string;
  vehicle_type: string;
  rating: number;
  distance: number;
  eta: string;
  status: 'online' | 'offline' | 'busy';
}

export interface Ride {
  id: string;
  passenger_phone: string;
  driver_id?: string;
  pickup_location: string;
  dropoff_location?: string;
  vehicle_type: string;
  scheduled_time?: string;
  status: 'pending' | 'confirmed' | 'en-route' | 'arrived' | 'completed' | 'cancelled';
  created_at: string;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  message: string;
  timestamp: string;
  type: 'text' | 'image' | 'document';
  processed?: boolean;
}

// Placeholder for OpenAI OCR processing
export const processInsuranceDocument = async (imageBase64: string): Promise<Partial<VehicleData>> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock OCR results for demonstration
  const mockResults = [
    {
      plate: "RAD 123 A",
      vin: "1HGBH41JXMN109186",
      make: "Toyota",
      model: "Corolla",
      model_year: 2020,
      insurance_provider: "SONARWA",
      insurance_policy: "POL-2024-001234",
      insurance_expiry: "2025-03-15"
    },
    {
      plate: "RCA 456 B", 
      vin: "JM1BL1SF0A1234567",
      make: "Honda",
      model: "Civic",
      model_year: 2019,
      insurance_provider: "RADIANT",
      insurance_policy: "INS-2024-005678",
      insurance_expiry: "2025-06-20"
    }
  ];
  
  // Return random mock result
  const result = mockResults[Math.floor(Math.random() * mockResults.length)];
  console.log("OCR Processing complete:", result);
  return result;
};

// Placeholder for saving vehicle data
export const saveVehicleData = async (vehicleData: VehicleData): Promise<{ success: boolean; id?: string }> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const vehicleId = `vehicle_${Date.now()}`;
  console.log("Vehicle saved:", { ...vehicleData, id: vehicleId });
  
  // Store in localStorage as placeholder
  const vehicles = JSON.parse(localStorage.getItem('vehicles') || '[]');
  vehicles.push({ ...vehicleData, id: vehicleId, created_at: new Date().toISOString() });
  localStorage.setItem('vehicles', JSON.stringify(vehicles));
  
  return { success: true, id: vehicleId };
};

// Placeholder for WhatsApp webhook processing
export const processWhatsAppMessage = async (message: WhatsAppMessage): Promise<{ success: boolean; response?: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log("Processing WhatsApp message:", message);
  
  // Mock response based on message content
  if (message.message.toLowerCase().includes('insurance')) {
    return {
      success: true,
      response: "Please upload your insurance certificate as an image."
    };
  }
  
  if (message.type === 'image') {
    return {
      success: true,
      response: "Insurance document received. Processing..."
    };
  }
  
  return {
    success: true,
    response: "Hello! Send 'insurance' to start vehicle registration process."
  };
};

// Placeholder for sending WhatsApp messages
export const sendWhatsAppMessage = async (to: string, message: string): Promise<{ success: boolean }> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  console.log(`Sending WhatsApp to ${to}:`, message);
  return { success: true };
};

// Get stored vehicles (placeholder for database query)
export const getVehicles = (): VehicleData[] => {
  return JSON.parse(localStorage.getItem('vehicles') || '[]');
};

// Check if user has MoMo number on file
export const getUserMoMo = async (phone: string): Promise<string | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const users = JSON.parse(localStorage.getItem('user_momos') || '{}');
  return users[phone] || null;
};

// Save user MoMo number
export const saveUserMoMo = async (phone: string, momo: string): Promise<{ success: boolean }> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const users = JSON.parse(localStorage.getItem('user_momos') || '{}');
  users[phone] = momo;
  localStorage.setItem('user_momos', JSON.stringify(users));
  return { success: true };
};

// Generate QR code with USSD
export const generatePaymentQR = async (momo: string, amount?: number): Promise<{ success: boolean; qr_url?: string; ussd?: string }> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const ussd = amount ? `*182*1*1*${momo}*${amount}#` : `*182*1*1*${momo}#`;
  const qr_url = `https://example.com/qr/${Date.now()}.png`;
  
  console.log("Generated QR for USSD:", ussd);
  return { success: true, qr_url, ussd };
};

// Decode QR code
export const decodeQR = async (imageBase64: string): Promise<{ success: boolean; ussd?: string }> => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Mock QR decode results
  const mockUSSD = "*182*1*1*0788123456*5000#";
  console.log("Decoded QR:", mockUSSD);
  return { success: true, ussd: mockUSSD };
};

// Get nearby drivers
export const getNearbyDrivers = async (location: string, vehicleType: string): Promise<Driver[]> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const mockDrivers: Driver[] = [
    {
      id: "driver_1",
      name: "Jean Claude",
      phone: "0788123456",
      plate: "RAD 123 A",
      vehicle_type: vehicleType,
      rating: 4.8,
      distance: 0.5,
      eta: "3 min",
      status: "online"
    },
    {
      id: "driver_2", 
      name: "Marie Rose",
      phone: "0788654321",
      plate: "RCA 456 B",
      vehicle_type: vehicleType,
      rating: 4.9,
      distance: 1.2,
      eta: "7 min",
      status: "online"
    }
  ];
  
  return mockDrivers;
};

// Create ride booking
export const createRide = async (rideData: Partial<Ride>): Promise<{ success: boolean; ride_id?: string }> => {
  await new Promise(resolve => setTimeout(resolve, 600));
  
  const rideId = `ride_${Date.now()}`;
  const ride = { ...rideData, id: rideId, created_at: new Date().toISOString() };
  
  const rides = JSON.parse(localStorage.getItem('rides') || '[]');
  rides.push(ride);
  localStorage.setItem('rides', JSON.stringify(rides));
  
  console.log("Ride created:", ride);
  return { success: true, ride_id: rideId };
};

// Get vehicle types from database
export const getVehicleTypes = async (): Promise<string[]> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return ['Moto Taxi', 'Cab', 'Liffan', 'Truck', 'Rental', 'Other'];
};

// Notify driver about ride request
export const notifyDriver = async (driverId: string, rideId: string): Promise<{ success: boolean }> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  console.log(`Notified driver ${driverId} about ride ${rideId}`);
  return { success: true };
};

// Driver response to ride request
export const driverResponse = async (rideId: string, action: 'confirm' | 'reject'): Promise<{ success: boolean }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log(`Driver ${action}ed ride ${rideId}`);
  return { success: true };
};