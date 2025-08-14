-- Fix the handle_new_user trigger to properly extract metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, wa_phone, wa_name, role, locale)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'phone', 
      NEW.phone, 
      ''
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name', 
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'::user_role
      WHEN NEW.raw_user_meta_data->>'role' = 'driver' THEN 'driver'::user_role
      ELSE 'user'::user_role
    END,
    'en'
  );
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create profile for existing user if missing
INSERT INTO public.profiles (user_id, wa_phone, wa_name, role, locale)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'phone', u.phone, ''),
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  'admin'::user_role,
  'en'
FROM auth.users u
WHERE u.id = 'cf6848ed-1edc-42e9-86f8-9ce733cc3f03'
ON CONFLICT (user_id) DO UPDATE SET
  wa_name = COALESCE(EXCLUDED.wa_name, profiles.wa_name),
  wa_phone = COALESCE(EXCLUDED.wa_phone, profiles.wa_phone),
  role = EXCLUDED.role;