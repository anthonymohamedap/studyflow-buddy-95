-- Create calendar_events table for all event types
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('course', 'planner', 'personal')),
  category TEXT NOT NULL CHECK (category IN ('theory', 'lab', 'group', 'project', 'assignment', 'deadline', 'exam', 'study', 'personal', 'holiday')),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  recurrence TEXT CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly')),
  recurrence_end_date TIMESTAMP WITH TIME ZONE,
  location TEXT,
  color TEXT,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own events"
ON public.calendar_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own events"
ON public.calendar_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
ON public.calendar_events FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
ON public.calendar_events FOR DELETE
USING (auth.uid() = user_id);

-- Index for efficient date range queries
CREATE INDEX idx_calendar_events_date_range ON public.calendar_events (user_id, start_date, end_date);
CREATE INDEX idx_calendar_events_user ON public.calendar_events (user_id);

-- Trigger for updated_at
CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();