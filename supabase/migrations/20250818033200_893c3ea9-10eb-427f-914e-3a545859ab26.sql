
-- Fix whatsapp_logs table structure to match the code expectations
DROP TABLE IF EXISTS public.whatsapp_logs CASCADE;

CREATE TABLE public.whatsapp_logs (
  id bigserial PRIMARY KEY,
  direction text CHECK (direction IN ('in', 'out')),
  phone_number text,
  message_type text,
  message_content text,
  message_id text,
  payload jsonb,
  metadata jsonb,
  status text DEFAULT 'received',
  created_at timestamptz DEFAULT now()
);

-- Create whatsapp_conversations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  current_step text NOT NULL DEFAULT 'MAIN_MENU',
  conversation_data jsonb DEFAULT '{}'::jsonb,
  last_activity_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
CREATE POLICY "Service role full access whatsapp_logs" ON public.whatsapp_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access whatsapp_conversations" ON public.whatsapp_conversations
  FOR ALL USING (auth.role() = 'service_role');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON public.whatsapp_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone ON public.whatsapp_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone ON public.whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_activity ON public.whatsapp_conversations(last_activity_at DESC);
