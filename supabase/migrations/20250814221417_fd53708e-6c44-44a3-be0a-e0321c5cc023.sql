-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'driver');
CREATE TYPE public.ride_status AS ENUM ('pending', 'confirmed', 'rejected', 'in_progress', 'completed', 'cancelled');

-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  wa_phone TEXT NOT NULL UNIQUE,
  wa_name TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  role user_role NOT NULL DEFAULT 'user',
  default_momo_phone TEXT,
  default_momo_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create drivers table
CREATE TABLE public.drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rating DECIMAL(3,2) DEFAULT 0.0,
  total_trips INTEGER DEFAULT 0,
  location JSONB,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  driver_features JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vehicle_types table
CREATE TABLE public.vehicle_types (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

-- Insert default vehicle types
INSERT INTO public.vehicle_types (code, label) VALUES
  ('moto', 'Moto Taxi'),
  ('cab', 'Cab'),
  ('liffan', 'Liffan (Goods)'),
  ('truck', 'Truck (Goods)'),
  ('rental', 'Rental (Passenger)');

-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_type TEXT NOT NULL REFERENCES public.vehicle_types(code),
  plate TEXT,
  vin TEXT,
  make TEXT,
  model TEXT,
  model_year INTEGER,
  insurance_provider TEXT,
  insurance_policy TEXT,
  insurance_expiry DATE,
  doc_url TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  extra JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rides table
CREATE TABLE public.rides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  passenger_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status ride_status NOT NULL DEFAULT 'pending',
  pickup JSONB,
  dropoff JSONB,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create qr_generations table
CREATE TABLE public.qr_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount DECIMAL(10,2),
  ussd TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create insurance_quotes table
CREATE TABLE public.insurance_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  quote_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create insurance_policies table
CREATE TABLE public.insurance_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.insurance_quotes(id),
  policy_number TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  premium_amount DECIMAL(10,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  policy_document_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create insurance_periods table
CREATE TABLE public.insurance_periods (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  months INTEGER NOT NULL,
  multiplier DECIMAL(4,3) NOT NULL DEFAULT 1.0
);

-- Insert default insurance periods
INSERT INTO public.insurance_periods (label, months, multiplier) VALUES
  ('1 Month', 1, 1.2),
  ('3 Months', 3, 1.1),
  ('6 Months', 6, 1.0),
  ('12 Months', 12, 0.9);

-- Create insurance_addons table
CREATE TABLE public.insurance_addons (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Insert default insurance addons
INSERT INTO public.insurance_addons (name, description, price) VALUES
  ('Theft Protection', 'Protection against vehicle theft', 50.00),
  ('Personal Accident', 'Personal injury coverage', 30.00),
  ('Third Party Liability', 'Coverage for damages to third parties', 25.00);

-- Create payment_plans table
CREATE TABLE public.payment_plans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  installments INTEGER NOT NULL,
  description TEXT
);

-- Insert default payment plans
INSERT INTO public.payment_plans (name, installments, description) VALUES
  ('Full Payment', 1, 'Pay the full amount upfront'),
  ('2 Installments', 2, 'Split payment into 2 parts'),
  ('3 Installments', 3, 'Split payment into 3 parts'),
  ('Monthly (12)', 12, 'Pay monthly over 12 months');

-- Create whatsapp_logs table
CREATE TABLE public.whatsapp_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  message_type TEXT NOT NULL,
  message_content TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  status TEXT NOT NULL DEFAULT 'sent',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for drivers
CREATE POLICY "Drivers can view their own data" ON public.drivers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Drivers can update their own data" ON public.drivers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all drivers" ON public.drivers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for vehicles
CREATE POLICY "Users can manage their own vehicles" ON public.vehicles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all vehicles" ON public.vehicles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for rides
CREATE POLICY "Users can view their own rides" ON public.rides
  FOR SELECT USING (
    auth.uid() = passenger_user_id OR 
    auth.uid() = driver_user_id
  );

CREATE POLICY "Users can create rides as passenger" ON public.rides
  FOR INSERT WITH CHECK (auth.uid() = passenger_user_id);

CREATE POLICY "Drivers can update rides assigned to them" ON public.rides
  FOR UPDATE USING (auth.uid() = driver_user_id);

CREATE POLICY "Admins can view all rides" ON public.rides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for other tables
CREATE POLICY "Users can manage their own QR generations" ON public.qr_generations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own insurance quotes" ON public.insurance_quotes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own insurance policies" ON public.insurance_policies
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own WhatsApp logs" ON public.whatsapp_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Create lookup table policies (public read access)
CREATE POLICY "Anyone can read vehicle types" ON public.vehicle_types
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read insurance periods" ON public.insurance_periods
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read insurance addons" ON public.insurance_addons
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read payment plans" ON public.payment_plans
  FOR SELECT USING (true);

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, wa_phone, wa_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')::user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rides_updated_at
  BEFORE UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_insurance_quotes_updated_at
  BEFORE UPDATE ON public.insurance_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_insurance_policies_updated_at
  BEFORE UPDATE ON public.insurance_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('documents', 'documents', false),
  ('qr-codes', 'qr-codes', true);

-- Create storage policies
CREATE POLICY "Users can upload their own documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "QR codes are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'qr-codes');

CREATE POLICY "Authenticated users can upload QR codes" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'qr-codes' AND 
    auth.role() = 'authenticated'
  );