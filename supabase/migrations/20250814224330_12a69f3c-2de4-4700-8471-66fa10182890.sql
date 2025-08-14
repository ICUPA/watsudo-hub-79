-- First check what profiles exist with empty phone
SELECT user_id, wa_phone, role FROM profiles WHERE wa_phone = '' OR wa_phone IS NULL;

-- Update the specific user to admin, handling the phone constraint
UPDATE public.profiles 
SET role = 'admin'::user_role,
    wa_phone = '919783ba-b091-4043-b12e-27d0eea5b0fc-temp',
    updated_at = now()
WHERE user_id = '919783ba-b091-4043-b12e-27d0eea5b0fc';

-- If user doesn't exist, insert them
INSERT INTO public.profiles (user_id, wa_phone, wa_name, role, locale)
SELECT '919783ba-b091-4043-b12e-27d0eea5b0fc', '919783ba-b091-4043-b12e-27d0eea5b0fc-admin', 'Admin User', 'admin'::user_role, 'en'
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = '919783ba-b091-4043-b12e-27d0eea5b0fc');