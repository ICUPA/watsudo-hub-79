-- Ensure the user exists in profiles table and set as admin
INSERT INTO public.profiles (user_id, wa_phone, wa_name, role, locale)
VALUES ('919783ba-b091-4043-b12e-27d0eea5b0fc', '', 'Admin User', 'admin'::user_role, 'en')
ON CONFLICT (user_id) 
DO UPDATE SET 
  role = 'admin'::user_role,
  updated_at = now();