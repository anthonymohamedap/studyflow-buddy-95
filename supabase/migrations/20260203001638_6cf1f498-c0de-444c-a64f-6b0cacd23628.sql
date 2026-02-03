-- Create user_preferences table for storing user settings like language preference
CREATE TABLE public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'nl')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own preferences"
ON public.user_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own preferences"
ON public.user_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
ON public.user_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add Dutch translation columns to document_chapters
ALTER TABLE public.document_chapters
ADD COLUMN title_nl TEXT,
ADD COLUMN content_nl TEXT,
ADD COLUMN translation_status TEXT DEFAULT 'pending' CHECK (translation_status IN ('pending', 'translating', 'completed', 'failed'));

-- Add Dutch translation columns to document_topics
ALTER TABLE public.document_topics
ADD COLUMN title_nl TEXT,
ADD COLUMN content_nl TEXT,
ADD COLUMN translation_status TEXT DEFAULT 'pending' CHECK (translation_status IN ('pending', 'translating', 'completed', 'failed'));

-- Add Dutch content column to revision_assets (JSONB for translated content)
ALTER TABLE public.revision_assets
ADD COLUMN content_nl JSONB DEFAULT '{}'::jsonb,
ADD COLUMN translation_status TEXT DEFAULT 'pending' CHECK (translation_status IN ('pending', 'translating', 'completed', 'failed'));