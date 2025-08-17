// Storage URL utilities for Supabase
// Environment variables for Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable");
}

if (!supabaseKey) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable");
}

export const storageUrls = {
  supabaseUrl,
  supabaseKey,
  
  // Helper function to get storage URL for a bucket and path
  getStorageUrl: (bucket: string, path: string): string => {
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
  },
  
  // Helper function to get signed URL for private files
  getSignedUrl: async (bucket: string, path: string, expiresIn: number = 3600): Promise<string | null> => {
    try {
      // This would need to be implemented with the Supabase client
      // For now, return null to indicate this needs to be implemented
      console.warn("getSignedUrl not implemented - requires Supabase client");
      return null;
    } catch (error) {
      console.error("Error generating signed URL:", error);
      return null;
    }
  }
};

// Canonical bucket names
export const BUCKETS = {
  QR: 'qr',
  VEHICLE_DOCS: 'vehicle_docs', 
  QUOTES: 'quotes',
  CERTIFICATES: 'certificates'
} as const;

/**
 * Generate public URL for public buckets (qr)
 */
export function getPublicUrl(bucket: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Generate signed URL for private buckets (vehicle_docs, quotes, certificates)
 * Note: This should be called from server-side code with service role key
 */
export async function getSignedUrl(
  bucket: string, 
  path: string, 
  expiresIn: number = 3600
): Promise<{ signedUrl: string; error?: string }> {
  try {
    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/${bucket}/${path}?expiresIn=${expiresIn}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to generate signed URL: ${response.status}`);
    }

    const data = await response.json();
    return { signedUrl: data.signedURL };
  } catch (error) {
    return { 
      signedUrl: '', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get appropriate URL for any bucket/path combination
 */
export function getStorageUrl(bucket: string, path: string): string {
  if (bucket === BUCKETS.QR) {
    return getPublicUrl(bucket, path);
  }
  
  // For private buckets, return the base URL that can be signed server-side
  return `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
}

/**
 * Helper to extract path components from full storage paths
 */
export function parseStoragePath(fullPath: string): { bucket: string; path: string } | null {
  // Handle paths like "vehicle_docs/user_id/file.pdf" or "docs/user_id/file.pdf"
  const parts = fullPath.split('/');
  if (parts.length < 2) return null;
  
  const bucket = parts[0];
  const path = parts.slice(1).join('/');
  
  return { bucket, path };
}

/**
 * Validate bucket name against canonical names
 */
export function isValidBucket(bucket: string): boolean {
  return Object.values(BUCKETS).includes(bucket as any);
}

/**
 * Get QR code URL from database file_path
 */
export function getQRCodeUrl(filePath: string): string {
  // filePath should be like "qr/user_id/uuid.png"
  const parsed = parseStoragePath(filePath);
  if (!parsed || parsed.bucket !== BUCKETS.QR) {
    throw new Error(`Invalid QR file path: ${filePath}`);
  }
  
  return getPublicUrl(parsed.bucket, parsed.path);
}

/**
 * Get vehicle document URL (requires server-side signing)
 */
export function getVehicleDocUrl(filePath: string): string {
  const parsed = parseStoragePath(filePath);
  if (!parsed || parsed.bucket !== BUCKETS.VEHICLE_DOCS) {
    throw new Error(`Invalid vehicle doc path: ${filePath}`);
  }
  
  return getStorageUrl(parsed.bucket, parsed.path);
}