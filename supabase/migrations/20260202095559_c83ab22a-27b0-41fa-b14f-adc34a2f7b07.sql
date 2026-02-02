-- =============================================
-- STUDYFLOW DATABASE SCHEMA
-- =============================================

-- Create ENUM types for status tracking
CREATE TYPE evaluation_type AS ENUM ('EXAM', 'PROJECT', 'PAPER', 'CONTINUOUS', 'MIXED');
CREATE TYPE ai_policy AS ENUM ('ALLOWED', 'LIMITED', 'FORBIDDEN');
CREATE TYPE source_type AS ENUM ('SLIDES', 'GITBOOK', 'VIDEO', 'PDF', 'OTHER');
CREATE TYPE theory_status AS ENUM ('NOT_VIEWED', 'REVIEWED', 'MASTERED');
CREATE TYPE exercise_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE');
CREATE TYPE exercise_type AS ENUM ('LAB', 'HOMEWORK', 'ASSIGNMENT');
CREATE TYPE project_status AS ENUM ('NOT_STARTED', 'PLANNING', 'IN_PROGRESS', 'REVIEW', 'SUBMITTED');

-- =============================================
-- COURSES TABLE
-- =============================================
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  lecturer TEXT,
  lecturer_email TEXT,
  evaluation_type evaluation_type NOT NULL DEFAULT 'EXAM',
  ai_policy ai_policy NOT NULL DEFAULT 'LIMITED',
  ai_policy_details TEXT,
  credits INTEGER DEFAULT 3,
  material_url TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for courses
CREATE POLICY "Users can view their own courses" 
ON public.courses FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own courses" 
ON public.courses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own courses" 
ON public.courses FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own courses" 
ON public.courses FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- THEORY TOPICS TABLE
-- =============================================
CREATE TABLE public.theory_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type source_type DEFAULT 'SLIDES',
  source_url TEXT,
  status theory_status NOT NULL DEFAULT 'NOT_VIEWED',
  personal_summary TEXT,
  week_number INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.theory_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for theory_topics
CREATE POLICY "Users can view theory topics of their courses" 
ON public.theory_topics FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = theory_topics.course_id AND courses.user_id = auth.uid()));

CREATE POLICY "Users can create theory topics for their courses" 
ON public.theory_topics FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = theory_topics.course_id AND courses.user_id = auth.uid()));

CREATE POLICY "Users can update theory topics of their courses" 
ON public.theory_topics FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = theory_topics.course_id AND courses.user_id = auth.uid()));

CREATE POLICY "Users can delete theory topics of their courses" 
ON public.theory_topics FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = theory_topics.course_id AND courses.user_id = auth.uid()));

-- =============================================
-- EXERCISES TABLE
-- =============================================
CREATE TABLE public.exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  exercise_type exercise_type DEFAULT 'LAB',
  status exercise_status NOT NULL DEFAULT 'NOT_STARTED',
  feedback TEXT,
  redo_for_exam BOOLEAN DEFAULT false,
  week_number INTEGER,
  deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exercises
CREATE POLICY "Users can view exercises of their courses" 
ON public.exercises FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = exercises.course_id AND courses.user_id = auth.uid()));

CREATE POLICY "Users can create exercises for their courses" 
ON public.exercises FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = exercises.course_id AND courses.user_id = auth.uid()));

CREATE POLICY "Users can update exercises of their courses" 
ON public.exercises FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = exercises.course_id AND courses.user_id = auth.uid()));

CREATE POLICY "Users can delete exercises of their courses" 
ON public.exercises FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = exercises.course_id AND courses.user_id = auth.uid()));

-- =============================================
-- PROJECTS TABLE
-- =============================================
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'NOT_STARTED',
  deadline TIMESTAMP WITH TIME ZONE,
  documentation_requirements TEXT,
  group_size INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view projects of their courses" 
ON public.projects FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = projects.course_id AND courses.user_id = auth.uid()));

CREATE POLICY "Users can create projects for their courses" 
ON public.projects FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = projects.course_id AND courses.user_id = auth.uid()));

CREATE POLICY "Users can update projects of their courses" 
ON public.projects FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = projects.course_id AND courses.user_id = auth.uid()));

CREATE POLICY "Users can delete projects of their courses" 
ON public.projects FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = projects.course_id AND courses.user_id = auth.uid()));

-- =============================================
-- DELIVERABLES TABLE
-- =============================================
CREATE TABLE public.deliverables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deliverables
CREATE POLICY "Users can view deliverables of their projects" 
ON public.deliverables FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.projects p 
  JOIN public.courses c ON c.id = p.course_id 
  WHERE p.id = deliverables.project_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can create deliverables for their projects" 
ON public.deliverables FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects p 
  JOIN public.courses c ON c.id = p.course_id 
  WHERE p.id = deliverables.project_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can update deliverables of their projects" 
ON public.deliverables FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.projects p 
  JOIN public.courses c ON c.id = p.course_id 
  WHERE p.id = deliverables.project_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can delete deliverables of their projects" 
ON public.deliverables FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.projects p 
  JOIN public.courses c ON c.id = p.course_id 
  WHERE p.id = deliverables.project_id AND c.user_id = auth.uid()
));

-- =============================================
-- TODO ITEMS TABLE
-- =============================================
CREATE TABLE public.todo_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for todo_items
CREATE POLICY "Users can view todos of their projects" 
ON public.todo_items FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.projects p 
  JOIN public.courses c ON c.id = p.course_id 
  WHERE p.id = todo_items.project_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can create todos for their projects" 
ON public.todo_items FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects p 
  JOIN public.courses c ON c.id = p.course_id 
  WHERE p.id = todo_items.project_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can update todos of their projects" 
ON public.todo_items FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.projects p 
  JOIN public.courses c ON c.id = p.course_id 
  WHERE p.id = todo_items.project_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can delete todos of their projects" 
ON public.todo_items FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.projects p 
  JOIN public.courses c ON c.id = p.course_id 
  WHERE p.id = todo_items.project_id AND c.user_id = auth.uid()
));

-- =============================================
-- WEEK PLANS TABLE
-- =============================================
CREATE TABLE public.week_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  theory_goals TEXT,
  exercise_goals TEXT,
  deliverable_goals TEXT,
  estimated_hours INTEGER DEFAULT 0,
  actual_hours INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(course_id, week_number)
);

-- Enable RLS
ALTER TABLE public.week_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for week_plans
CREATE POLICY "Users can view week plans of their courses" 
ON public.week_plans FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = week_plans.course_id AND courses.user_id = auth.uid()));

CREATE POLICY "Users can create week plans for their courses" 
ON public.week_plans FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = week_plans.course_id AND courses.user_id = auth.uid()));

CREATE POLICY "Users can update week plans of their courses" 
ON public.week_plans FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = week_plans.course_id AND courses.user_id = auth.uid()));

CREATE POLICY "Users can delete week plans of their courses" 
ON public.week_plans FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = week_plans.course_id AND courses.user_id = auth.uid()));

-- =============================================
-- UPDATE TIMESTAMP FUNCTION & TRIGGERS
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_theory_topics_updated_at
BEFORE UPDATE ON public.theory_topics
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exercises_updated_at
BEFORE UPDATE ON public.exercises
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_week_plans_updated_at
BEFORE UPDATE ON public.week_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();