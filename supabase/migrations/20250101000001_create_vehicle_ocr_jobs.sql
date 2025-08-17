-- Create vehicle_ocr_jobs table for async OCR processing
-- This table queues media files for background OCR processing to avoid blocking webhook responses

CREATE TABLE IF NOT EXISTS public.vehicle_ocr_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL,
  usage_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  result_data JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicle_ocr_jobs_status ON public.vehicle_ocr_jobs(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_ocr_jobs_user_id ON public.vehicle_ocr_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_ocr_jobs_created_at ON public.vehicle_ocr_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_vehicle_ocr_jobs_pending ON public.vehicle_ocr_jobs(status, created_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.vehicle_ocr_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own OCR jobs"
ON public.vehicle_ocr_jobs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service can manage all OCR jobs"
ON public.vehicle_ocr_jobs
FOR ALL
USING (auth.role() = 'service_role');

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION public.update_vehicle_ocr_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_vehicle_ocr_jobs_updated_at
BEFORE UPDATE ON public.vehicle_ocr_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_vehicle_ocr_jobs_updated_at();
