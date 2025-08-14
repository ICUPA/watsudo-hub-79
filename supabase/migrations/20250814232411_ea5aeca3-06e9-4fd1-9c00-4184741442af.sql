-- Create conversation states table for WhatsApp flow management
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step TEXT NOT NULL DEFAULT 'main_menu',
  conversation_data JSONB NOT NULL DEFAULT '{}',
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(phone_number)
);

-- Create index for fast lookups
CREATE INDEX idx_whatsapp_conversations_phone ON whatsapp_conversations(phone_number);
CREATE INDEX idx_whatsapp_conversations_user_id ON whatsapp_conversations(user_id);
CREATE INDEX idx_whatsapp_conversations_step ON whatsapp_conversations(current_step);

-- Enable RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own WhatsApp conversations"
ON public.whatsapp_conversations
FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Service can manage all conversations"
ON public.whatsapp_conversations
FOR ALL
USING (auth.role() = 'service_role');

-- Create function to update updated_at
CREATE TRIGGER update_whatsapp_conversations_updated_at
BEFORE UPDATE ON public.whatsapp_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for WhatsApp file uploads
CREATE TABLE public.whatsapp_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  purpose TEXT, -- 'insurance_document', 'qr_code', etc.
  processed BOOLEAN NOT NULL DEFAULT false,
  processing_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on files table
ALTER TABLE public.whatsapp_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for files
CREATE POLICY "Users can manage their own WhatsApp files"
ON public.whatsapp_files
FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Service can manage all files"
ON public.whatsapp_files
FOR ALL
USING (auth.role() = 'service_role');

-- Update whatsapp_logs to allow service role access
DROP POLICY IF EXISTS "Users can view their own WhatsApp logs" ON public.whatsapp_logs;

CREATE POLICY "Users can view their own WhatsApp logs"
ON public.whatsapp_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service can manage all WhatsApp logs"
ON public.whatsapp_logs
FOR ALL
USING (auth.role() = 'service_role');