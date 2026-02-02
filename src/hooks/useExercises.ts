import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Exercise = Database['public']['Tables']['exercises']['Row'];
type ExerciseInsert = Database['public']['Tables']['exercises']['Insert'];
type ExerciseUpdate = Database['public']['Tables']['exercises']['Update'];

export function useExercises(courseId: string | undefined) {
  const queryClient = useQueryClient();

  const exercisesQuery = useQuery({
    queryKey: ['exercises', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('course_id', courseId)
        .order('week_number', { ascending: true })
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as Exercise[];
    },
    enabled: !!courseId,
  });

  const createExercise = useMutation({
    mutationFn: async (exercise: ExerciseInsert) => {
      const { data, error } = await supabase
        .from('exercises')
        .insert(exercise)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises', courseId] });
      toast.success('Exercise added!');
    },
    onError: (error) => {
      toast.error('Failed to add exercise: ' + error.message);
    },
  });

  const updateExercise = useMutation({
    mutationFn: async ({ id, ...updates }: ExerciseUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('exercises')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises', courseId] });
    },
    onError: (error) => {
      toast.error('Failed to update exercise: ' + error.message);
    },
  });

  const deleteExercise = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises', courseId] });
      toast.success('Exercise deleted!');
    },
    onError: (error) => {
      toast.error('Failed to delete exercise: ' + error.message);
    },
  });

  return {
    exercises: exercisesQuery.data ?? [],
    isLoading: exercisesQuery.isLoading,
    error: exercisesQuery.error,
    createExercise,
    updateExercise,
    deleteExercise,
  };
}
