-- Fix profiles table for WhatsApp users who don't have auth.users records
-- Make user_id nullable since WhatsApp users won't have Supabase auth accounts
ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;

-- Update the chat_sessions foreign key to work with profile id instead
-- since WhatsApp users use profile.id as their identifier
ALTER TABLE public.chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_user_id_fkey;

-- Update RLS policies to work with both authenticated users and WhatsApp-only profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create new policies that work for both auth users and WhatsApp-only profiles
CREATE POLICY "Users can view their own profile" ON public.profiles 
FOR SELECT USING (
  auth.uid() = user_id OR 
  (user_id IS NULL AND id = auth.uid()) OR
  auth.role() = 'service_role'
);

CREATE POLICY "Users can update their own profile" ON public.profiles 
FOR UPDATE USING (
  auth.uid() = user_id OR 
  (user_id IS NULL AND id = auth.uid()) OR
  auth.role() = 'service_role'
);

CREATE POLICY "Users can insert their own profile" ON public.profiles 
FOR INSERT WITH CHECK (
  auth.uid() = user_id OR 
  user_id IS NULL OR
  auth.role() = 'service_role'
);

-- Service role can manage all profiles
CREATE POLICY "Service can manage all profiles" ON public.profiles 
FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);