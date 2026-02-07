import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

export interface LabDocument {
  id: string;
  course_id: string;
  title: string;
  title_nl: string | null;
  description: string | null;
  description_nl: string | null;
  file_path: string | null;
  source_url: string | null;
  week_number: number | null;
  deadline: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  parsing_status: string | null;
  parsing_error: string | null;
  parsed_at: string | null;
  translation_status: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface LabAsset {
  id: string;
  lab_id: string;
  asset_type: 'summary' | 'approach_plan' | 'checklist' | 'key_terms' | 'how_to';
  content: Record<string, unknown>;
  content_nl: Record<string, unknown> | null;
  translation_status: string | null;
  is_generating: boolean | null;
  generated_at: string | null;
}

export interface LabSection {
  id: string;
  lab_id: string;
  section_type: 'description' | 'requirements' | 'tasks' | 'deliverables' | 'evaluation' | 'other';
  title: string | null;
  title_nl: string | null;
  content: string | null;
  content_nl: string | null;
  sort_order: number | null;
}

export function useLabs(courseId: string | undefined) {
  const { language } = useLanguage();
  
  const { data: labs = [], isLoading, refetch } = useQuery({
    queryKey: ['labs', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const { data, error } = await supabase
        .from('lab_documents')
        .select('*')
        .eq('course_id', courseId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as LabDocument[];
    },
    enabled: !!courseId,
  });

  // Transform labs to use correct language
  const translatedLabs = labs.map(lab => ({
    ...lab,
    displayTitle: language === 'nl' && lab.title_nl ? lab.title_nl : lab.title,
    displayDescription: language === 'nl' && lab.description_nl ? lab.description_nl : lab.description,
  }));

  return { labs: translatedLabs, isLoading, refetch };
}

export function useLab(labId: string | undefined) {
  const { language } = useLanguage();

  const { data: lab, isLoading } = useQuery({
    queryKey: ['lab', labId],
    queryFn: async () => {
      if (!labId) return null;
      const { data, error } = await supabase
        .from('lab_documents')
        .select('*')
        .eq('id', labId)
        .single();
      
      if (error) throw error;
      return data as LabDocument;
    },
    enabled: !!labId,
  });

  const translatedLab = lab ? {
    ...lab,
    displayTitle: language === 'nl' && lab.title_nl ? lab.title_nl : lab.title,
    displayDescription: language === 'nl' && lab.description_nl ? lab.description_nl : lab.description,
  } : null;

  return { lab: translatedLab, isLoading };
}

export function useLabAssets(labId: string | undefined) {
  const { language } = useLanguage();

  const { data: assets = [], isLoading, refetch } = useQuery({
    queryKey: ['lab_assets', labId],
    queryFn: async () => {
      if (!labId) return [];
      const { data, error } = await supabase
        .from('lab_assets')
        .select('*')
        .eq('lab_id', labId);
      
      if (error) throw error;
      return data as LabAsset[];
    },
    enabled: !!labId,
  });

  // Get asset by type with language support
  const getAsset = (type: LabAsset['asset_type']) => {
    const asset = assets.find(a => a.asset_type === type);
    if (!asset) return null;

    const useNl = language === 'nl' && asset.content_nl && Object.keys(asset.content_nl).length > 0;
    return {
      ...asset,
      displayContent: useNl ? asset.content_nl : asset.content,
      needsTranslation: language === 'nl' && (!asset.content_nl || Object.keys(asset.content_nl).length === 0),
    };
  };

  return { 
    assets, 
    isLoading, 
    refetch,
    summary: getAsset('summary'),
    approachPlan: getAsset('approach_plan'),
    checklist: getAsset('checklist'),
    howTo: getAsset('how_to'),
  };
}

export function useLabSections(labId: string | undefined) {
  const { language } = useLanguage();

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['lab_sections', labId],
    queryFn: async () => {
      if (!labId) return [];
      const { data, error } = await supabase
        .from('lab_sections')
        .select('*')
        .eq('lab_id', labId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as LabSection[];
    },
    enabled: !!labId,
  });

  const translatedSections = sections.map(section => ({
    ...section,
    displayTitle: language === 'nl' && section.title_nl ? section.title_nl : section.title,
    displayContent: language === 'nl' && section.content_nl ? section.content_nl : section.content,
  }));

  return { sections: translatedSections, isLoading };
}

export function useLabMutations() {
  const queryClient = useQueryClient();

  const createLab = useMutation({
    mutationFn: async (data: { 
      courseId: string; 
      title: string; 
      weekNumber?: number;
      deadline?: string;
      filePath?: string;
    }) => {
      const { data: lab, error } = await supabase
        .from('lab_documents')
        .insert({
          course_id: data.courseId,
          title: data.title,
          week_number: data.weekNumber,
          deadline: data.deadline,
          file_path: data.filePath,
        })
        .select()
        .single();
      
      if (error) throw error;
      return lab;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['labs', variables.courseId] });
      toast.success('Lab created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create lab: ${error.message}`);
    },
  });

  const updateLab = useMutation({
    mutationFn: async ({ id, ...data }: Partial<LabDocument> & { id: string }) => {
      const { error } = await supabase
        .from('lab_documents')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labs'] });
      queryClient.invalidateQueries({ queryKey: ['lab'] });
    },
  });

  const deleteLab = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lab_documents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labs'] });
      toast.success('Lab deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete lab: ${error.message}`);
    },
  });

  const parseLab = useMutation({
    mutationFn: async ({ labId, filePath, fileContent }: { 
      labId: string; 
      filePath?: string;
      fileContent?: string;
    }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-lab`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ labId, filePath, fileContent }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to parse lab');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lab', variables.labId] });
      queryClient.invalidateQueries({ queryKey: ['lab_assets', variables.labId] });
      queryClient.invalidateQueries({ queryKey: ['lab_sections', variables.labId] });
      toast.success('Lab analyzed successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to analyze lab: ${error.message}`);
    },
  });

  return { createLab, updateLab, deleteLab, parseLab };
}
