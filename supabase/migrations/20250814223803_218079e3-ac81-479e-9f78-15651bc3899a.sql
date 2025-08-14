-- Set user 919783ba-b091-4043-b12e-27d0eea5b0fc to admin role
UPDATE public.profiles 
SET role = 'admin'::user_role 
WHERE user_id = '919783ba-b091-4043-b12e-27d0eea5b0fc';