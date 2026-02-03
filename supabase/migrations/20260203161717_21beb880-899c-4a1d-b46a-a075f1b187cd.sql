-- Create knowledge_archive table for AI-generated explanations and summaries
CREATE TABLE public.knowledge_archive (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'explanation', -- 'explanation', 'summary', 'ai_answer', 'note'
  source_type TEXT, -- 'topic', 'lab', 'course', 'exercise', 'project'
  source_id UUID, -- Reference to the source item
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  semester TEXT, -- e.g., '2025-2026-S1'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add archive support to topic_notes
ALTER TABLE public.topic_notes 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS semester TEXT;

-- Enable RLS on knowledge_archive
ALTER TABLE public.knowledge_archive ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for knowledge_archive
CREATE POLICY "Users can view their own knowledge entries"
ON public.knowledge_archive
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own knowledge entries"
ON public.knowledge_archive
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge entries"
ON public.knowledge_archive
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge entries"
ON public.knowledge_archive
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_knowledge_archive_user_id ON public.knowledge_archive(user_id);
CREATE INDEX idx_knowledge_archive_course_id ON public.knowledge_archive(course_id);
CREATE INDEX idx_knowledge_archive_source ON public.knowledge_archive(source_type, source_id);
CREATE INDEX idx_knowledge_archive_semester ON public.knowledge_archive(semester);

-- Create trigger for updated_at
CREATE TRIGGER update_knowledge_archive_updated_at
BEFORE UPDATE ON public.knowledge_archive
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();