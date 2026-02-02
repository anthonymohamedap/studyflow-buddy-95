import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type TheoryTopic = Database['public']['Tables']['theory_topics']['Row'];
type TheoryTopicInsert = Database['public']['Tables']['theory_topics']['Insert'];
type TheoryTopicUpdate = Database['public']['Tables']['theory_topics']['Update'];

export function useTheoryTopics(courseId: string | undefined) {
  const queryClient = useQueryClient();

  const topicsQuery = useQuery({
    queryKey: ['theory_topics', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const { data, error } = await supabase
        .from('theory_topics')
        .select('*')
        .eq('course_id', courseId)
        .order('week_number', { ascending: true })
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as TheoryTopic[];
    },
    enabled: !!courseId,
  });

  const createTopic = useMutation({
    mutationFn: async (topic: TheoryTopicInsert) => {
      const { data, error } = await supabase
        .from('theory_topics')
        .insert(topic)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theory_topics', courseId] });
      toast.success('Topic added!');
    },
    onError: (error) => {
      toast.error('Failed to add topic: ' + error.message);
    },
  });

  const updateTopic = useMutation({
    mutationFn: async ({ id, ...updates }: TheoryTopicUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('theory_topics')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theory_topics', courseId] });
    },
    onError: (error) => {
      toast.error('Failed to update topic: ' + error.message);
    },
  });

  const deleteTopic = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('theory_topics')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theory_topics', courseId] });
      toast.success('Topic deleted!');
    },
    onError: (error) => {
      toast.error('Failed to delete topic: ' + error.message);
    },
  });

  return {
    topics: topicsQuery.data ?? [],
    isLoading: topicsQuery.isLoading,
    error: topicsQuery.error,
    createTopic,
    updateTopic,
    deleteTopic,
  };
}
