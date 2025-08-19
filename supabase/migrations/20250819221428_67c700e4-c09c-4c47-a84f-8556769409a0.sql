-- Enable RLS on all new tables
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_leads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for WhatsApp flow system (mostly service role access)

-- WhatsApp conversations (service role manages all)
CREATE POLICY "Service role manages all conversations" ON public.whatsapp_conversations
  FOR ALL USING (auth.role() = 'service_role');

-- Flow submissions (service role manages all, for auditing)
CREATE POLICY "Service role manages all flow submissions" ON public.flow_submissions
  FOR ALL USING (auth.role() = 'service_role');

-- QR defaults (service role manages all)
CREATE POLICY "Service role manages all QR defaults" ON public.qr_defaults
  FOR ALL USING (auth.role() = 'service_role');

-- Driver locations (service role manages all)
CREATE POLICY "Service role manages all driver locations" ON public.driver_locations
  FOR ALL USING (auth.role() = 'service_role');

-- Insurance leads (service role manages all)
CREATE POLICY "Service role manages all insurance leads" ON public.insurance_leads
  FOR ALL USING (auth.role() = 'service_role');