-- Add file_path column to theory_topics for document attachments
ALTER TABLE public.theory_topics ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Create storage bucket for course materials
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-materials', 'course-materials', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the storage bucket
CREATE POLICY "Users can upload course materials"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'course-materials' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view course materials"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-materials');

CREATE POLICY "Users can delete their course materials"
ON storage.objects FOR DELETE
USING (bucket_id = 'course-materials' AND auth.uid() IS NOT NULL);