import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

type TranslationType = 'chapter' | 'topic' | 'revision_asset';

interface TranslateParams {
  type: TranslationType;
  id: string;
}

interface BulkTranslateParams {
  type: 'course';
  id: string;
}

export function useTranslateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ type, id }: TranslateParams) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ type, id }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to translate content');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries based on type
      if (variables.type === 'chapter') {
        queryClient.invalidateQueries({ queryKey: ['document_chapters'] });
      } else if (variables.type === 'topic') {
        queryClient.invalidateQueries({ queryKey: ['document_topics'] });
        queryClient.invalidateQueries({ queryKey: ['document_topic'] });
      } else if (variables.type === 'revision_asset') {
        queryClient.invalidateQueries({ queryKey: ['revision_asset'] });
        queryClient.invalidateQueries({ queryKey: ['revision_assets'] });
      }
      toast.success('Translation completed!');
    },
    onError: (error) => {
      toast.error(`Translation failed: ${error.message}`);
    },
  });
}

export function useBulkTranslate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ type, id }: BulkTranslateParams) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ type, id, bulk: true }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to translate content');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document_chapters'] });
      queryClient.invalidateQueries({ queryKey: ['document_topics'] });
      queryClient.invalidateQueries({ queryKey: ['revision_assets'] });
      toast.success('Bulk translation completed!');
    },
    onError: (error) => {
      toast.error(`Bulk translation failed: ${error.message}`);
    },
  });
}

// Helper hook to get translated content
export function useTranslatedContent<T extends { title?: string; title_nl?: string; content?: unknown; content_nl?: unknown; translation_status?: string }>(
  data: T | null | undefined
): {
  title: string;
  content: unknown;
  needsTranslation: boolean;
  isTranslating: boolean;
} {
  const { language } = useLanguage();

  if (!data) {
    return { title: '', content: null, needsTranslation: false, isTranslating: false };
  }

  const isNl = language === 'nl';
  const hasNlTitle = !!data.title_nl;
  const hasNlContent = !!data.content_nl && Object.keys(data.content_nl as object).length > 0;
  const isTranslating = data.translation_status === 'translating';

  return {
    title: isNl && hasNlTitle ? data.title_nl! : data.title || '',
    content: isNl && hasNlContent ? data.content_nl : data.content,
    needsTranslation: isNl && (!hasNlTitle || !hasNlContent) && data.translation_status !== 'translating',
    isTranslating,
  };
}
