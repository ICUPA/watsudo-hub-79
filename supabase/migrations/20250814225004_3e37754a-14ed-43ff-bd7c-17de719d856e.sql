-- Fix RLS policies for profiles table to prevent infinite recursion
-- Drop the problematic admin policy and recreate it properly
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create a simpler admin policy that doesn't cause recursion
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles admin_profile 
    WHERE admin_profile.user_id = auth.uid() 
    AND admin_profile.role = 'admin'::user_role
  )
  OR auth.uid() = user_id
);