// Placeholder Supabase client - will be replaced with real Supabase integration
export interface Profile {
  id: string;
  wa_phone: string;
  wa_name?: string;
  locale: string;
  role: 'user' | 'admin' | 'driver';
  default_momo_phone?: string;
  default_momo_code?: string;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  user_id: string;
  is_active: boolean;
  rating: number;
  total_trips: number;
  location?: { lat: number; lng: number };
  last_seen_at?: string;
  driver_features: Record<string, any>;
  profile?: Profile;
}

export interface Vehicle {
  id: string;
  user_id: string;
  usage_type: string;
  plate?: string;
  vin?: string;
  make?: string;
  model?: string;
  model_year?: number;
  insurance_provider?: string;
  insurance_policy?: string;
  insurance_expiry?: string;
  doc_url?: string;
  verified: boolean;
  extra: Record<string, any>;
  created_at: string;
}

export interface Ride {
  id: string;
  passenger_user_id: string;
  driver_user_id?: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';
  pickup?: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number };
  scheduled_for?: string;
  meta: Record<string, any>;
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

export interface VehicleType {
  id: number;
  code: string;
  label: string;
}

// Mock data
const mockProfiles: Profile[] = [
  {
    id: "1",
    wa_phone: "+250781234567",
    wa_name: "Jean Uwimana",
    locale: "en",
    role: "user",
    default_momo_phone: "+250781234567",
    default_momo_code: "12345",
    created_at: "2024-01-15T10:30:00Z",
    updated_at: "2024-01-20T14:22:00Z"
  },
  {
    id: "2",
    wa_phone: "+250782345678",
    wa_name: "Marie Mukamana",
    locale: "en",
    role: "driver",
    default_momo_phone: "+250782345678",
    default_momo_code: "67890",
    created_at: "2024-01-12T09:15:00Z",
    updated_at: "2024-01-20T13:45:00Z"
  },
  {
    id: "3",
    wa_phone: "+250783456789",
    wa_name: "Paul Nkurunziza",
    locale: "en",
    role: "admin",
    default_momo_phone: "+250783456789",
    default_momo_code: "54321",
    created_at: "2024-01-10T16:20:00Z",
    updated_at: "2024-01-20T15:10:00Z"
  }
];

const mockDrivers: Driver[] = [
  {
    id: "d1",
    user_id: "2",
    is_active: true,
    rating: 4.8,
    total_trips: 156,
    location: { lat: -1.9441, lng: 30.0619 },
    last_seen_at: "2024-01-20T15:30:00Z",
    driver_features: {},
    profile: mockProfiles[1]
  }
];

const mockVehicles: Vehicle[] = [
  {
    id: "v1",
    user_id: "2",
    usage_type: "moto",
    plate: "RAC 123A",
    vin: "VIN123456789",
    make: "Honda",
    model: "CB125",
    model_year: 2022,
    insurance_provider: "SONARWA",
    insurance_policy: "POL123456",
    insurance_expiry: "2024-12-31",
    doc_url: "docs/insurance_cert.pdf",
    verified: true,
    extra: {},
    created_at: "2024-01-15T10:30:00Z"
  }
];

const mockRides: Ride[] = [
  {
    id: "r1",
    passenger_user_id: "1",
    driver_user_id: "d1",
    status: "completed",
    pickup: { lat: -1.9500, lng: 30.0588 },
    dropoff: { lat: -1.9441, lng: 30.0619 },
    scheduled_for: undefined,
    meta: { fare: 2000, distance_km: 5.2 },
    created_at: "2024-01-20T08:30:00Z",
    updated_at: "2024-01-20T09:15:00Z"
  }
];

const mockVehicleTypes: VehicleType[] = [
  { id: 1, code: "moto", label: "Moto Taxi" },
  { id: 2, code: "cab", label: "Cab" },
  { id: 3, code: "liffan", label: "Liffan (Goods)" },
  { id: 4, code: "truck", label: "Truck (Goods)" },
  { id: 5, code: "rental", label: "Rental (Passenger)" }
];

// Placeholder Supabase client
export const supabasePlaceholder = {
  from: (table: string) => ({
    select: (columns = "*") => ({
      order: (column: string, options?: { ascending: boolean }) => ({
        then: async (callback: (result: { data: any[] | null; error: any }) => void) => {
          let data: any[] = [];
          
          switch (table) {
            case "profiles":
              data = [...mockProfiles];
              break;
            case "drivers":
              data = mockDrivers.map(d => ({
                ...d,
                profiles: d.profile
              }));
              break;
            case "vehicles":
              data = [...mockVehicles];
              break;
            case "rides":
              data = [...mockRides];
              break;
            case "vehicle_types":
              data = [...mockVehicleTypes];
              break;
          }
          
          if (options && !options.ascending) {
            data.reverse();
          }
          
          callback({ data, error: null });
        }
      }),
      single: () => ({
        then: async (callback: (result: { data: any | null; error: any }) => void) => {
          let data: any = null;
          
          switch (table) {
            case "profiles":
              data = mockProfiles[0];
              break;
            case "drivers":
              data = mockDrivers[0];
              break;
          }
          
          callback({ data, error: null });
        }
      })
    }),
    insert: (values: any) => ({
      select: (columns = "*") => ({
        single: () => ({
          then: async (callback: (result: { data: any | null; error: any }) => void) => {
            const newItem = {
              id: crypto.randomUUID(),
              ...values,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            
            switch (table) {
              case "profiles":
                mockProfiles.unshift(newItem);
                break;
              case "vehicles":
                mockVehicles.unshift(newItem);
                break;
              case "qr_generations":
                // Handle QR generation
                break;
            }
            
            callback({ data: newItem, error: null });
          }
        })
      })
    }),
    update: (updates: any) => ({
      eq: (column: string, value: any) => ({
        then: async (callback: (result: { data: any | null; error: any }) => void) => {
          let updated = false;
          
          switch (table) {
            case "profiles":
              const profileIndex = mockProfiles.findIndex(p => p[column as keyof Profile] === value);
              if (profileIndex >= 0) {
                mockProfiles[profileIndex] = { ...mockProfiles[profileIndex], ...updates, updated_at: new Date().toISOString() };
                updated = true;
              }
              break;
            case "vehicles":
              const vehicleIndex = mockVehicles.findIndex(v => v[column as keyof Vehicle] === value);
              if (vehicleIndex >= 0) {
                mockVehicles[vehicleIndex] = { ...mockVehicles[vehicleIndex], ...updates };
                updated = true;
              }
              break;
          }
          
          callback({ data: updated ? updates : null, error: updated ? null : "Item not found" });
        }
      })
    })
  }),
  rpc: (functionName: string, params: any) => ({
    then: async (callback: (result: { data: any[] | null; error: any }) => void) => {
      if (functionName === "nearby_drivers") {
        // Simulate nearby drivers query
        const drivers = mockDrivers.filter(d => d.location).map(d => ({
          driver_id: d.id,
          distance_km: Math.random() * 10,
          wa_phone: d.profile?.wa_phone,
          wa_name: d.profile?.wa_name
        }));
        callback({ data: drivers, error: null });
      } else {
        callback({ data: [], error: null });
      }
    }
  }),
  storage: {
    from: (bucket: string) => ({
      upload: async (path: string, file: File | Blob) => {
        // Simulate file upload
        return { data: { path }, error: null };
      },
      createSignedUrl: async (path: string, expiresIn: number) => {
        // Simulate signed URL creation
        return { data: { signedUrl: `https://placeholder-storage.com/${path}` }, error: null };
      }
    })
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
    const local = identifier.startsWith("+250") ? `0${identifier.slice(4)}` : identifier;
    return amount ? `*182*1*1*${local}*${amount}#` : `*182*1*1*${local}#`;
  } else {
    return amount ? `*182*8*1*${identifier}*${amount}#` : `*182*8*1*${identifier}#`;
  }
};

export const buildTelLink = (ussd: string): string => {
  return `tel:${encodeURIComponent(ussd).replace(/%2A/g, "*")}`;
};

// OCR placeholder function
export const ocrVehicleDocument = async (imageUrl: string): Promise<any> => {
  // Simulate OCR processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Return mock OCR results
  return {
    plate: "RAC " + Math.floor(Math.random() * 999) + "A",
    vin: "VIN" + Math.random().toString(36).substring(2, 15).toUpperCase(),
    make: ["Toyota", "Honda", "Hyundai", "Suzuki"][Math.floor(Math.random() * 4)],
    model: ["Corolla", "Civic", "Elantra", "Swift"][Math.floor(Math.random() * 4)],
    model_year: 2020 + Math.floor(Math.random() * 5),
    insurance_provider: ["SONARWA", "SORAS", "Radiant Insurance"][Math.floor(Math.random() * 3)],
    insurance_policy: "POL" + Math.random().toString(36).substring(2, 8).toUpperCase(),
    insurance_expiry: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  };
};