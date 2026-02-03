-- Create lab_documents table
CREATE TABLE public.lab_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_nl TEXT,
  description TEXT,
  description_nl TEXT,
  file_path TEXT,
  source_url TEXT,
  week_number INTEGER,
  deadline TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  parsing_status TEXT DEFAULT 'pending' CHECK (parsing_status IN ('pending', 'parsing', 'completed', 'error')),
  parsing_error TEXT,
  parsed_at TIMESTAMP WITH TIME ZONE,
  translation_status TEXT DEFAULT 'pending',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lab_assets table for generated content
CREATE TABLE public.lab_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_id UUID NOT NULL REFERENCES public.lab_documents(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('summary', 'approach_plan', 'checklist', 'key_terms')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_nl JSONB DEFAULT '{}'::jsonb,
  translation_status TEXT DEFAULT 'pending',
  is_generating BOOLEAN DEFAULT false,
  generated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lab_id, asset_type)
);

-- Create lab_sections table for extracted content sections
CREATE TABLE public.lab_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_id UUID NOT NULL REFERENCES public.lab_documents(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL CHECK (section_type IN ('description', 'requirements', 'tasks', 'deliverables', 'evaluation', 'other')),
  title TEXT,
  title_nl TEXT,
  content TEXT,
  content_nl TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lab_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_sections ENABLE ROW LEVEL SECURITY;

-- RLS policies for lab_documents
CREATE POLICY "Users can view labs of their courses" 
  ON public.lab_documents FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM courses WHERE courses.id = lab_documents.course_id AND courses.user_id = auth.uid()
  ));

CREATE POLICY "Users can create labs for their courses" 
  ON public.lab_documents FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM courses WHERE courses.id = lab_documents.course_id AND courses.user_id = auth.uid()
  ));

CREATE POLICY "Users can update labs of their courses" 
  ON public.lab_documents FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM courses WHERE courses.id = lab_documents.course_id AND courses.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete labs of their courses" 
  ON public.lab_documents FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM courses WHERE courses.id = lab_documents.course_id AND courses.user_id = auth.uid()
  ));

-- RLS policies for lab_assets
CREATE POLICY "Users can view lab assets of their courses" 
  ON public.lab_assets FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM lab_documents ld 
    JOIN courses c ON c.id = ld.course_id 
    WHERE ld.id = lab_assets.lab_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can create lab assets for their courses" 
  ON public.lab_assets FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_documents ld 
    JOIN courses c ON c.id = ld.course_id 
    WHERE ld.id = lab_assets.lab_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can update lab assets of their courses" 
  ON public.lab_assets FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM lab_documents ld 
    JOIN courses c ON c.id = ld.course_id 
    WHERE ld.id = lab_assets.lab_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete lab assets of their courses" 
  ON public.lab_assets FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM lab_documents ld 
    JOIN courses c ON c.id = ld.course_id 
    WHERE ld.id = lab_assets.lab_id AND c.user_id = auth.uid()
  ));

-- RLS policies for lab_sections
CREATE POLICY "Users can view lab sections of their courses" 
  ON public.lab_sections FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM lab_documents ld 
    JOIN courses c ON c.id = ld.course_id 
    WHERE ld.id = lab_sections.lab_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can create lab sections for their courses" 
  ON public.lab_sections FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_documents ld 
    JOIN courses c ON c.id = ld.course_id 
    WHERE ld.id = lab_sections.lab_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can update lab sections of their courses" 
  ON public.lab_sections FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM lab_documents ld 
    JOIN courses c ON c.id = ld.course_id 
    WHERE ld.id = lab_sections.lab_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete lab sections of their courses" 
  ON public.lab_sections FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM lab_documents ld 
    JOIN courses c ON c.id = ld.course_id 
    WHERE ld.id = lab_sections.lab_id AND c.user_id = auth.uid()
  ));

-- Add triggers for updated_at
CREATE TRIGGER update_lab_documents_updated_at
  BEFORE UPDATE ON public.lab_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lab_assets_updated_at
  BEFORE UPDATE ON public.lab_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();