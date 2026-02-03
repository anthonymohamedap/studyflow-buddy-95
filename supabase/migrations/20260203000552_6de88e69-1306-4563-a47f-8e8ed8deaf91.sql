-- Create table for parsed document chapters
CREATE TABLE public.document_chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  theory_topic_id UUID NOT NULL REFERENCES public.theory_topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  page_start INTEGER,
  page_end INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for topics within chapters
CREATE TABLE public.document_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id UUID NOT NULL REFERENCES public.document_chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for revision assets (summaries, flashcards, quizzes, keywords)
CREATE TABLE public.revision_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES public.document_topics(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('summary', 'flashcards', 'quiz', 'keywords')),
  content JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMP WITH TIME ZONE,
  is_generating BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(topic_id, asset_type)
);

-- Create table for user notes on topics
CREATE TABLE public.topic_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES public.document_topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(topic_id, user_id)
);

-- Add parsing status to theory_topics
ALTER TABLE public.theory_topics 
ADD COLUMN parsing_status TEXT DEFAULT 'pending' CHECK (parsing_status IN ('pending', 'parsing', 'completed', 'failed')),
ADD COLUMN parsed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN parsing_error TEXT;

-- Enable RLS on all new tables
ALTER TABLE public.document_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_chapters (via theory_topics -> courses)
CREATE POLICY "Users can view chapters of their course topics"
ON public.document_chapters FOR SELECT
USING (EXISTS (
  SELECT 1 FROM theory_topics tt
  JOIN courses c ON c.id = tt.course_id
  WHERE tt.id = document_chapters.theory_topic_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can create chapters for their course topics"
ON public.document_chapters FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM theory_topics tt
  JOIN courses c ON c.id = tt.course_id
  WHERE tt.id = document_chapters.theory_topic_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can update chapters of their course topics"
ON public.document_chapters FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM theory_topics tt
  JOIN courses c ON c.id = tt.course_id
  WHERE tt.id = document_chapters.theory_topic_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can delete chapters of their course topics"
ON public.document_chapters FOR DELETE
USING (EXISTS (
  SELECT 1 FROM theory_topics tt
  JOIN courses c ON c.id = tt.course_id
  WHERE tt.id = document_chapters.theory_topic_id AND c.user_id = auth.uid()
));

-- RLS policies for document_topics (via chapters -> theory_topics -> courses)
CREATE POLICY "Users can view document topics of their courses"
ON public.document_topics FOR SELECT
USING (EXISTS (
  SELECT 1 FROM document_chapters dc
  JOIN theory_topics tt ON tt.id = dc.theory_topic_id
  JOIN courses c ON c.id = tt.course_id
  WHERE dc.id = document_topics.chapter_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can create document topics for their courses"
ON public.document_topics FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM document_chapters dc
  JOIN theory_topics tt ON tt.id = dc.theory_topic_id
  JOIN courses c ON c.id = tt.course_id
  WHERE dc.id = document_topics.chapter_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can update document topics of their courses"
ON public.document_topics FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM document_chapters dc
  JOIN theory_topics tt ON tt.id = dc.theory_topic_id
  JOIN courses c ON c.id = tt.course_id
  WHERE dc.id = document_topics.chapter_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can delete document topics of their courses"
ON public.document_topics FOR DELETE
USING (EXISTS (
  SELECT 1 FROM document_chapters dc
  JOIN theory_topics tt ON tt.id = dc.theory_topic_id
  JOIN courses c ON c.id = tt.course_id
  WHERE dc.id = document_topics.chapter_id AND c.user_id = auth.uid()
));

-- RLS policies for revision_assets (via document_topics -> chapters -> theory_topics -> courses)
CREATE POLICY "Users can view revision assets of their courses"
ON public.revision_assets FOR SELECT
USING (EXISTS (
  SELECT 1 FROM document_topics dt
  JOIN document_chapters dc ON dc.id = dt.chapter_id
  JOIN theory_topics tt ON tt.id = dc.theory_topic_id
  JOIN courses c ON c.id = tt.course_id
  WHERE dt.id = revision_assets.topic_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can create revision assets for their courses"
ON public.revision_assets FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM document_topics dt
  JOIN document_chapters dc ON dc.id = dt.chapter_id
  JOIN theory_topics tt ON tt.id = dc.theory_topic_id
  JOIN courses c ON c.id = tt.course_id
  WHERE dt.id = revision_assets.topic_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can update revision assets of their courses"
ON public.revision_assets FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM document_topics dt
  JOIN document_chapters dc ON dc.id = dt.chapter_id
  JOIN theory_topics tt ON tt.id = dc.theory_topic_id
  JOIN courses c ON c.id = tt.course_id
  WHERE dt.id = revision_assets.topic_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can delete revision assets of their courses"
ON public.revision_assets FOR DELETE
USING (EXISTS (
  SELECT 1 FROM document_topics dt
  JOIN document_chapters dc ON dc.id = dt.chapter_id
  JOIN theory_topics tt ON tt.id = dc.theory_topic_id
  JOIN courses c ON c.id = tt.course_id
  WHERE dt.id = revision_assets.topic_id AND c.user_id = auth.uid()
));

-- RLS policies for topic_notes
CREATE POLICY "Users can view their own notes"
ON public.topic_notes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes"
ON public.topic_notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
ON public.topic_notes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
ON public.topic_notes FOR DELETE
USING (auth.uid() = user_id);

-- Create updated_at triggers
CREATE TRIGGER update_document_chapters_updated_at
BEFORE UPDATE ON public.document_chapters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_topics_updated_at
BEFORE UPDATE ON public.document_topics
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_revision_assets_updated_at
BEFORE UPDATE ON public.revision_assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_topic_notes_updated_at
BEFORE UPDATE ON public.topic_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();