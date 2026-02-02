import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
type TodoItem = Database['public']['Tables']['todo_items']['Row'];
type TodoItemInsert = Database['public']['Tables']['todo_items']['Insert'];

export function useProject(courseId: string | undefined) {
  const queryClient = useQueryClient();

  const projectQuery = useQuery({
    queryKey: ['project', courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (error) throw error;
      return data as Project | null;
    },
    enabled: !!courseId,
  });

  const createProject = useMutation({
    mutationFn: async (project: ProjectInsert) => {
      const { data, error } = await supabase
        .from('projects')
        .insert(project)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', courseId] });
      toast.success('Project created!');
    },
    onError: (error) => {
      toast.error('Failed to create project: ' + error.message);
    },
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, ...updates }: ProjectUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', courseId] });
    },
    onError: (error) => {
      toast.error('Failed to update project: ' + error.message);
    },
  });

  return {
    project: projectQuery.data,
    isLoading: projectQuery.isLoading,
    error: projectQuery.error,
    createProject,
    updateProject,
  };
}

export function useTodoItems(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const todosQuery = useQuery({
    queryKey: ['todos', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('todo_items')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as TodoItem[];
    },
    enabled: !!projectId,
  });

  const createTodo = useMutation({
    mutationFn: async (todo: TodoItemInsert) => {
      const { data, error } = await supabase
        .from('todo_items')
        .insert(todo)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', projectId] });
    },
    onError: (error) => {
      toast.error('Failed to add todo: ' + error.message);
    },
  });

  const updateTodo = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { data, error } = await supabase
        .from('todo_items')
        .update({ completed })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', projectId] });
    },
    onError: (error) => {
      toast.error('Failed to update todo: ' + error.message);
    },
  });

  const deleteTodo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('todo_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', projectId] });
    },
    onError: (error) => {
      toast.error('Failed to delete todo: ' + error.message);
    },
  });

  return {
    todos: todosQuery.data ?? [],
    isLoading: todosQuery.isLoading,
    createTodo,
    updateTodo,
    deleteTodo,
  };
}
