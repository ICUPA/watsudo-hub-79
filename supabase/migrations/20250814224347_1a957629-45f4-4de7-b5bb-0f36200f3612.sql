-- Set the existing user to admin role
UPDATE public.profiles 
SET role = 'admin'::user_role,
    updated_at = now()
WHERE user_id = 'cf6848ed-1edc-42e9-86f8-9ce733cc3f03';