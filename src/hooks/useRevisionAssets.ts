import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type AssetType = 'summary' | 'flashcards' | 'quiz' | 'keywords';

interface RevisionAsset {
  id: string;
  topic_id: string;
  asset_type: AssetType;
  content: Record<string, unknown>;
  content_nl: Record<string, unknown> | null;
  generated_at: string | null;
  is_generating: boolean;
  translation_status: string | null;
  created_at: string;
  updated_at: string;
}

interface SummaryContent {
  mainPoints: string[];
  detailedExplanation: string;
  keyTakeaways: string[];
}

interface FlashcardContent {
  cards: Array<{
    question: string;
    answer: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
}

interface QuizContent {
  questions: Array<{
    type: 'mcq' | 'open';
    question: string;
    options: string[] | null;
    correctAnswer: string;
    explanation: string;
  }>;
}

interface KeywordsContent {
  terms: Array<{
    term: string;
    definition: string;
    importance: 'high' | 'medium' | 'low';
  }>;
}

export type { SummaryContent, FlashcardContent, QuizContent, KeywordsContent, RevisionAsset, AssetType };

export function useRevisionAsset(topicId: string | undefined, assetType: AssetType) {
  return useQuery({
    queryKey: ['revision_asset', topicId, assetType],
    queryFn: async () => {
      if (!topicId) return null;
      
      const { data, error } = await supabase
        .from('revision_assets')
        .select('*')
        .eq('topic_id', topicId)
        .eq('asset_type', assetType)
        .maybeSingle();
      
      if (error) throw error;
      return data as RevisionAsset | null;
    },
    enabled: !!topicId,
    refetchInterval: (query) => {
      // Poll while generating
      const data = query.state.data as RevisionAsset | null;
      return data?.is_generating ? 2000 : false;
    },
  });
}

export function useAllRevisionAssets(topicId: string | undefined) {
  return useQuery({
    queryKey: ['revision_assets', topicId],
    queryFn: async () => {
      if (!topicId) return [];
      
      const { data, error } = await supabase
        .from('revision_assets')
        .select('*')
        .eq('topic_id', topicId);
      
      if (error) throw error;
      return data as RevisionAsset[];
    },
    enabled: !!topicId,
  });
}

export function useGenerateRevision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      topicId,
      assetType,
      topicContent,
      topicTitle,
    }: {
      topicId: string;
      assetType: AssetType;
      topicContent: string;
      topicTitle?: string;
    }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-revision`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ topicId, assetType, topicContent, topicTitle }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate revision content');
      }

      return response.json();
    },
    onMutate: async ({ topicId, assetType }) => {
      // Optimistically update to show generating state
      queryClient.setQueryData(['revision_asset', topicId, assetType], (old: RevisionAsset | null) => ({
        ...old,
        is_generating: true,
      }));
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['revision_asset', variables.topicId, variables.assetType] });
      queryClient.invalidateQueries({ queryKey: ['revision_assets', variables.topicId] });
    },
    onError: (error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['revision_asset', variables.topicId, variables.assetType] });
      toast.error(`Failed to generate ${variables.assetType}: ${error.message}`);
    },
  });
}

export function useTopicNotes(topicId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();

  const notesQuery = useQuery({
    queryKey: ['topic_notes', topicId, userId],
    queryFn: async () => {
      if (!topicId || !userId) return null;
      
      const { data, error } = await supabase
        .from('topic_notes')
        .select('*')
        .eq('topic_id', topicId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!topicId && !!userId,
  });

  const saveNotes = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      if (!topicId || !userId) throw new Error('Missing topic or user');

      const { data, error } = await supabase
        .from('topic_notes')
        .upsert({
          topic_id: topicId,
          user_id: userId,
          content,
        }, { onConflict: 'topic_id,user_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic_notes', topicId, userId] });
    },
    onError: (error) => {
      toast.error(`Failed to save notes: ${error.message}`);
    },
  });

  return {
    notes: notesQuery.data,
    isLoading: notesQuery.isLoading,
    saveNotes,
  };
}
