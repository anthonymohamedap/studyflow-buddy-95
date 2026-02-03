-- Add missing metadata columns to calendar_events
ALTER TABLE public.calendar_events
ADD COLUMN IF NOT EXISTS status text DEFAULT 'NOT_STARTED',
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'MEDIUM',
ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES public.document_topics(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS lab_id uuid REFERENCES public.lab_documents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS exercise_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS estimated_duration integer,
ADD COLUMN IF NOT EXISTS actual_duration integer,
ADD COLUMN IF NOT EXISTS redo_for_exam boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS feedback text,
ADD COLUMN IF NOT EXISTS notes text;

-- Create index for efficient time-range queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_range ON public.calendar_events(user_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_course ON public.calendar_events(course_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON public.calendar_events(status);

-- Drop the Google Calendar related tables
DROP TABLE IF EXISTS public.calendar_event_links;
DROP TABLE IF EXISTS public.google_tokens;