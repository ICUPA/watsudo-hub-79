-- Create admin test accounts for remo and developer
INSERT INTO public.profiles (
  wa_phone, 
  wa_name, 
  role, 
  locale
) VALUES 
  ('+250788123456', 'Remo Admin', 'admin', 'en'),
  ('+250788123457', 'Developer Admin', 'admin', 'en')
ON CONFLICT (wa_phone) DO UPDATE SET
  wa_name = EXCLUDED.wa_name,
  role = EXCLUDED.role;