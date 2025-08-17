/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_MAPS_BROWSER_KEY: string
  readonly VITE_NODE_ENV: string
  readonly VITE_TIMEZONE: string
  
  // Legacy support
  readonly NEXT_PUBLIC_SUPABASE_URL: string
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  readonly NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
