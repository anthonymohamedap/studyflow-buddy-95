import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Chapter {
  id: string;
  theory_topic_id: string;
  title: string;
  title_nl: string | null;
  content: string | null;
  content_nl: string | null;
  page_start: number | null;
  page_end: number | null;
  sort_order: number | null;
  translation_status: string | null;
  created_at: string;
  updated_at: string;
}

interface Topic {
  id: string;
  chapter_id: string;
  title: string;
  title_nl: string | null;
  content: string | null;
  content_nl: string | null;
  sort_order: number | null;
  translation_status: string | null;
  created_at: string;
  updated_at: string;
}

interface ChapterWithTopics extends Chapter {
  topics: Topic[];
}

export type { Chapter, Topic, ChapterWithTopics };

export function useDocumentChapters(theoryTopicId: string | undefined) {
  return useQuery({
    queryKey: ['document_chapters', theoryTopicId],
    queryFn: async () => {
      if (!theoryTopicId) return [];
      
      const { data: chapters, error: chaptersError } = await supabase
        .from('document_chapters')
        .select('*')
        .eq('theory_topic_id', theoryTopicId)
        .order('sort_order', { ascending: true });
      
      if (chaptersError) throw chaptersError;
      
      // Fetch topics for each chapter
      const chaptersWithTopics: ChapterWithTopics[] = [];
      
      for (const chapter of chapters) {
        const { data: topics, error: topicsError } = await supabase
          .from('document_topics')
          .select('*')
          .eq('chapter_id', chapter.id)
          .order('sort_order', { ascending: true });
        
        if (topicsError) throw topicsError;
        
        chaptersWithTopics.push({
          ...chapter,
          topics: topics || [],
        });
      }
      
      return chaptersWithTopics;
    },
    enabled: !!theoryTopicId,
  });
}

export function useDocumentTopic(topicId: string | undefined) {
  return useQuery({
    queryKey: ['document_topic', topicId],
    queryFn: async () => {
      if (!topicId) return null;
      
      const { data, error } = await supabase
        .from('document_topics')
        .select('*')
        .eq('id', topicId)
        .single();
      
      if (error) throw error;
      return data as Topic;
    },
    enabled: !!topicId,
  });
}

export function useParseDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      theoryTopicId, 
      documentContent, 
      documentTitle 
    }: { 
      theoryTopicId: string; 
      documentContent: string; 
      documentTitle?: string;
    }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ theoryTopicId, documentContent, documentTitle }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to parse document');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['document_chapters', variables.theoryTopicId] });
      queryClient.invalidateQueries({ queryKey: ['theory_topics'] });
      toast.success('Document parsed successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to parse document: ${error.message}`);
    },
  });
}
