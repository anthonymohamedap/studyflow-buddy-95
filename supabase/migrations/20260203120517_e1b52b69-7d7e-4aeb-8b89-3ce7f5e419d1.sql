-- Create table to store Google OAuth tokens
CREATE TABLE public.google_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  calendar_id TEXT DEFAULT 'primary',
  sync_token TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create table to link Google Calendar events to local entities
CREATE TABLE public.calendar_event_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  google_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'course', 'lab', 'project', 'exercise', 'personal', 'deadline'
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  lab_id UUID REFERENCES public.lab_documents(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  all_day BOOLEAN DEFAULT false,
  color TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, google_event_id)
);

-- Enable RLS
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for google_tokens
CREATE POLICY "Users can view their own tokens"
  ON public.google_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON public.google_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON public.google_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
  ON public.google_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for calendar_event_links
CREATE POLICY "Users can view their own event links"
  ON public.calendar_event_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own event links"
  ON public.calendar_event_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own event links"
  ON public.calendar_event_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own event links"
  ON public.calendar_event_links FOR DELETE
  USING (auth.uid() = user_id);

-- Add updated_at triggers
CREATE TRIGGER update_google_tokens_updated_at
  BEFORE UPDATE ON public.google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_event_links_updated_at
  BEFORE UPDATE ON public.calendar_event_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_calendar_event_links_user_id ON public.calendar_event_links(user_id);
CREATE INDEX idx_calendar_event_links_google_event_id ON public.calendar_event_links(google_event_id);
CREATE INDEX idx_calendar_event_links_course_id ON public.calendar_event_links(course_id);
CREATE INDEX idx_calendar_event_links_start_date ON public.calendar_event_links(start_date);
CREATE INDEX idx_calendar_event_links_event_type ON public.calendar_event_links(event_type);