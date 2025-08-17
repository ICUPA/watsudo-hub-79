// Quick test for WhatsApp function
// IMPORTANT: This file contains hardcoded secrets and should not be used in production
// Use environment variables instead:
// SUPABASE_URL=your-project-url
// SUPABASE_ANON_KEY=your-anon-key

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// TODO: Replace with environment variables
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

if (supabaseUrl === 'https://your-project.supabase.co' || supabaseKey === 'your-anon-key') {
  console.error('❌ Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
  console.error('❌ This test file contains placeholder values and will not work');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Test debug endpoint
console.log('Testing WhatsApp function debug endpoint...')
const { data, error } = await supabase.functions.invoke('whatsapp/debug', {
  method: 'POST'
})

console.log('Result:', { data, error })