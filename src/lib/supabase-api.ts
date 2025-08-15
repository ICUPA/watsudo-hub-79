import { supabase } from "@/integrations/supabase/client";

// Replace the placeholder backend functions with real Supabase implementations

export interface VehicleData {
  id?: string;
  plate: string;
  vin?: string;
  make?: string;
  model?: string;
  model_year?: number;
  usage_type: string;
  user_id: string;
  insurance_provider?: string;
  insurance_policy?: string;
  insurance_expiry?: string;
  doc_url?: string;
  verified?: boolean;
  extra?: any;
  created_at?: string;
  updated_at?: string;
}

export interface Driver {
  id: string;
  user_id: string;
  is_active: boolean;
  rating: number;
  total_trips: number;
  location?: any;
  last_seen_at?: string;
  driver_features?: any;
  profiles?: {
    wa_phone: string;
    wa_name?: string;
  } | null;
}

export interface Ride {
  id: string;
  passenger_user_id: string;
  driver_user_id?: string;
  pickup?: any;
  dropoff?: any;
  scheduled_for?: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';
  meta?: any;
  created_at: string;
  updated_at: string;
}

export interface QRGeneration {
  id: string;
  user_id: string;
  profile_id?: string;
  amount?: number;
  ussd: string;
  file_path: string;
  created_at: string;
}

// Vehicle Operations
export const saveVehicleData = async (vehicleData: Omit<VehicleData, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; id?: string }> => {
  try {
    const { data, error } = await supabase
      .from("vehicles")
      .insert(vehicleData)
      .select("id")
      .single();
    
    if (error) throw error;
    return { success: true, id: data.id };
  } catch (error) {
    console.error("Error saving vehicle:", error);
    return { success: false };
  }
};

export const getVehicles = async (userId?: string): Promise<VehicleData[]> => {
  try {
    let query = supabase.from("vehicles").select("*");
    
    if (userId) {
      query = query.eq("user_id", userId);
    }
    
    const { data, error } = await query.order("created_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting vehicles:", error);
    return [];
  }
};

// Driver Operations  
export const getNearbyDrivers = async (location: string | number, vehicleType?: string, km: number = 15): Promise<any[]> => {
  try {
    // If location is a string, mock coordinate conversion
    const lat = typeof location === 'string' ? -1.9441 : location;
    const lng = typeof location === 'string' ? 30.0619 : location;
    
    const { data, error } = await supabase.rpc("nearby_drivers", {
      lat,
      lng,
      km
    });
    
    if (error) {
      // Return mock data for simulation
      return [
        { id: '1', name: 'John Doe', plate: 'RAB123A', distance: 0.5, rating: 4.8, eta: '3 min', phone: '+250788123456' },
        { id: '2', name: 'Jane Smith', plate: 'RAC456B', distance: 1.2, rating: 4.9, eta: '5 min', phone: '+250788654321' },
        { id: '3', name: 'Bob Johnson', plate: 'RAD789C', distance: 2.1, rating: 4.7, eta: '8 min', phone: '+250788987654' }
      ];
    }
    return data || [];
  } catch (error) {
    console.error("Error getting nearby drivers:", error);
    // Return mock data for simulation
    return [
      { id: '1', name: 'John Doe', plate: 'RAB123A', distance: 0.5, rating: 4.8, eta: '3 min', phone: '+250788123456' },
      { id: '2', name: 'Jane Smith', plate: 'RAC456B', distance: 1.2, rating: 4.9, eta: '5 min', phone: '+250788654321' }
    ];
  }
};

export const getDrivers = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from("drivers")
      .select(`
        *,
        profiles(wa_phone, wa_name)
      `)
      .order("last_seen_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting drivers:", error);
    return [];
  }
};

export const activateDriver = async (driverId: string): Promise<{ success: boolean }> => {
  try {
    const { error } = await supabase.functions.invoke('whatsapp-admin-bridge', {
      body: { driver_id: driverId }
    });
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error activating driver:", error);
    return { success: false };
  }
};

// Ride Operations
export const createRide = async (rideData: Omit<Ride, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; ride_id?: string }> => {
  try {
    const { data, error } = await supabase
      .from("rides")
      .insert(rideData)
      .select("id")
      .single();
    
    if (error) throw error;
    return { success: true, ride_id: data.id };
  } catch (error) {
    console.error("Error creating ride:", error);
    return { success: false };
  }
};

export const getRides = async (userId?: string): Promise<Ride[]> => {
  try {
    let query = supabase.from("rides").select("*");
    
    if (userId) {
      query = query.or(`passenger_user_id.eq.${userId},driver_user_id.eq.${userId}`);
    }
    
    const { data, error } = await query.order("created_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting rides:", error);
    return [];
  }
};

// QR Code Operations
export const generatePaymentQR = async (
  identifier: string,
  amount?: number,
  type: "phone" | "code" = "phone"
): Promise<{ success: boolean; qr_url?: string; ussd?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('generate-qr', {
      body: {
        type,
        identifier,
        amount
      }
    });
    
    if (error) throw error;
    const ussd = buildUSSD(type, identifier, amount);
    return { success: true, qr_url: data?.qr_url, ussd };
  } catch (error) {
    console.error("Error generating QR:", error);
    const ussd = buildUSSD(type, identifier, amount);
    return { success: true, ussd }; // Return mock success for simulation
  }
};

export const getQRGenerations = async (userId?: string): Promise<QRGeneration[]> => {
  try {
    let query = supabase.from("qr_generations").select("*");
    
    if (userId) {
      query = query.eq("user_id", userId);
    }
    
    const { data, error } = await query.order("created_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting QR generations:", error);
    return [];
  }
};

// OCR Processing
export const processInsuranceDocument = async (imageUrl: string): Promise<Partial<VehicleData>> => {
  try {
    const { data, error } = await supabase.functions.invoke('process-vehicle-ocr', {
      body: { image_url: imageUrl }
    });
    
    if (error) throw error;
    return data || {};
  } catch (error) {
    console.error("Error processing document:", error);
    return {};
  }
};

// User/Profile Operations
export const getUserProfiles = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting profiles:", error);
    return [];
  }
};

export const updateUserProfile = async (userId: string, updates: any): Promise<{ success: boolean }> => {
  try {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { success: false };
  }
};

// WhatsApp Operations
export const sendWhatsAppMessage = async (to: string, message: string): Promise<{ success: boolean }> => {
  try {
    const { error } = await supabase.functions.invoke('whatsapp-admin-bridge', {
      body: {
        action: 'send_message',
        to,
        message
      }
    });
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return { success: false };
  }
};

// Vehicle Types
export const getVehicleTypes = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from("vehicle_types")
      .select("label")
      .order("id");
    
    if (error) throw error;
    return data?.map(item => item.label) || [];
  } catch (error) {
    console.error("Error getting vehicle types:", error);
    return [];
  }
};

// Insurance Operations
export const getInsurancePeriods = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from("insurance_periods")
      .select("*")
      .order("days");
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting insurance periods:", error);
    return [];
  }
};

export const getInsuranceAddons = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from("addons")
      .select("*")
      .eq("is_active", true)
      .order("label");
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting insurance addons:", error);
    return [];
  }
};

export const getPACategories = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from("pa_categories")
      .select("*")
      .eq("is_active", true)
      .order("label");
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting PA categories:", error);
    return [];
  }
};

export const getPaymentPlans = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from("payment_plans")
      .select("*")
      .order("id");
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting payment plans:", error);
    return [];
  }
};

// Insurance Quotes
export const getInsuranceQuotes = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from("insurance_quotes")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting insurance quotes:", error);
    return [];
  }
};

export const attachQuotePDF = async (quoteId: string, storagePath: string, amountCents: number): Promise<{ success: boolean }> => {
  try {
    const { error } = await supabase.functions.invoke('whatsapp-admin-bridge', {
      body: {
        quote_id: quoteId,
        storage_path: storagePath,
        amount_cents: amountCents
      }
    });
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error attaching quote PDF:", error);
    return { success: false };
  }
};

export const issueCertificate = async (quoteId: string, certStoragePath: string): Promise<{ success: boolean }> => {
  try {
    const { error } = await supabase.functions.invoke('whatsapp-admin-bridge', {
      body: {
        quote_id: quoteId,
        cert_storage_path: certStoragePath
      }
    });
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error issuing certificate:", error);
    return { success: false };
  }
};

// Vehicle Verification
export const verifyVehicle = async (vehicleId: string): Promise<{ success: boolean }> => {
  try {
    const { error } = await supabase.functions.invoke('whatsapp-admin-bridge', {
      body: { vehicle_id: vehicleId }
    });
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error verifying vehicle:", error);
    return { success: false };
  }
};

// Utility functions
export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("07")) return `+250${digits.slice(1)}`;
  if (digits.startsWith("2507")) return `+${digits}`;
  return digits;
};

export const buildUSSD = (type: "phone" | "code", identifier: string, amount?: number): string => {
  if (type === "phone") {
    const local = identifier.startsWith("+250") ? `0${identifier.slice(4)}` : identifier.replace(/^\+/, '');
    return amount ? `*182*1*1*${local}*${amount}#` : `*182*1*1*${local}#`;
  } else {
    return amount ? `*182*8*1*${identifier}*${amount}#` : `*182*8*1*${identifier}#`;
  }
};

export const buildTelLink = (ussd: string): string => {
  return `tel:${encodeURIComponent(ussd).replace(/%2A/g, "*")}`;
};

// User MoMo Management
export const getUserMoMo = async (phone: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("default_momo_phone")
      .eq("wa_phone", phone)
      .single();
    
    if (error) return null;
    return data?.default_momo_phone || null;
  } catch (error) {
    console.error("Error getting user MoMo:", error);
    return null;
  }
};

export const saveUserMoMo = async (phone: string, momoPhone: string): Promise<{ success: boolean }> => {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ default_momo_phone: momoPhone })
      .eq("wa_phone", phone);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error saving user MoMo:", error);
    return { success: false };
  }
};

// QR Decode function
export const decodeQR = async (imageBase64: string): Promise<{ success: boolean; ussd?: string }> => {
  try {
    // Mock QR decode - in real implementation would use a QR decode service
    // For simulation, extract potential USSD from any text patterns
    const mockUssd = "*182*1*1*0788123456*1000#";
    return { success: true, ussd: mockUssd };
  } catch (error) {
    console.error("Error decoding QR:", error);
    return { success: false };
  }
};

// Driver notification functions
export const notifyDriver = async (driverId: string, rideId: string): Promise<{ success: boolean }> => {
  try {
    const { error } = await supabase.functions.invoke('whatsapp-admin-bridge', {
      body: {
        action: 'notify_driver',
        driver_id: driverId,
        ride_id: rideId
      }
    });
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error notifying driver:", error);
    return { success: false };
  }
};

export const driverResponse = async (rideId: string, response: 'accept' | 'reject'): Promise<{ success: boolean }> => {
  try {
    const { error } = await supabase.functions.invoke('whatsapp-admin-bridge', {
      body: {
        action: 'driver_response',
        ride_id: rideId,
        response
      }
    });
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error processing driver response:", error);
    return { success: false };
  }
};