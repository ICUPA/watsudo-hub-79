// Storage URL utilities for consistent file access across the app

interface StorageConfig {
  supabaseUrl: string;
  supabaseKey: string;
}

const config: StorageConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lgicrnzvnbmsnxhzytro.supabase.co",
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnaWNybnp2bmJtc254aHp5dHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMDg5MDgsImV4cCI6MjA3MDc4NDkwOH0.org4HqULlkLKD4ZPKtUD9aFGxNxuLRm82n-y6USJVfs"
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
  return `${config.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
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
      `${config.supabaseUrl}/storage/v1/object/sign/${bucket}/${path}?expiresIn=${expiresIn}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.supabaseKey}`,
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
  return `${config.supabaseUrl}/storage/v1/object/${bucket}/${path}`;
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