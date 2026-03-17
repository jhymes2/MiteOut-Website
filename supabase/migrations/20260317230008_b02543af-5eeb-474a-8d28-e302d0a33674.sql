-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Hives table
CREATE TABLE public.hives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hive_code TEXT,
  notes TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hives" ON public.hives FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own hives" ON public.hives FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own hives" ON public.hives FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own hives" ON public.hives FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_hives_updated_at BEFORE UPDATE ON public.hives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Uploads table
CREATE TABLE public.uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hive_id UUID NOT NULL REFERENCES public.hives(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  rows_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own uploads" ON public.uploads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own uploads" ON public.uploads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Readings table
CREATE TABLE public.readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hive_id UUID NOT NULL REFERENCES public.hives(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES public.uploads(id) ON DELETE SET NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  temperature_c DOUBLE PRECISION,
  humidity_pct DOUBLE PRECISION,
  weight_lbs DOUBLE PRECISION,
  ina260_current_ma DOUBLE PRECISION,
  ina260_voltage_mv DOUBLE PRECISION,
  ina260_power_mw DOUBLE PRECISION,
  thermistor_ext_f DOUBLE PRECISION,
  thermistor2_f DOUBLE PRECISION,
  thermistor3_f DOUBLE PRECISION,
  UNIQUE(hive_id, timestamp)
);

ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view readings for own hives" ON public.readings
  FOR SELECT USING (
    hive_id IN (SELECT id FROM public.hives WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert readings for own hives" ON public.readings
  FOR INSERT WITH CHECK (
    hive_id IN (SELECT id FROM public.hives WHERE user_id = auth.uid())
  );

CREATE INDEX idx_readings_hive_timestamp ON public.readings(hive_id, timestamp);

-- CSV uploads storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('csv-uploads', 'csv-uploads', false);

CREATE POLICY "Users can upload their own CSVs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'csv-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own CSVs" ON storage.objects
  FOR SELECT USING (bucket_id = 'csv-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);