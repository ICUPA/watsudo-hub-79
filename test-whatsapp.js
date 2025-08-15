// Quick test for WhatsApp function
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  'https://lgicrnzvnbmsnxhzytro.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnaWNybnp2bmJtc254aHp5dHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMDg5MDgsImV4cCI6MjA3MDc4NDkwOH0.org4HqULlkLKD4ZPKtUD9aFGxNxuLRm82n-y6USJVfs'
)

// Test debug endpoint
console.log('Testing WhatsApp function debug endpoint...')
const { data, error } = await supabase.functions.invoke('whatsapp/debug', {
  method: 'POST'
})

console.log('Result:', { data, error })