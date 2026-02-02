import type { Database } from '@/integrations/supabase/types';

export type Exercise = Database['public']['Tables']['exercises']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type Deliverable = Database['public']['Tables']['deliverables']['Row'];
export type TheoryTopic = Database['public']['Tables']['theory_topics']['Row'];
export type Course = Database['public']['Tables']['courses']['Row'];

export type CalendarViewMode = 'week' | 'month' | 'year';

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  endDate?: Date;
  type: 'exercise' | 'project' | 'deliverable' | 'exam' | 'holiday' | 'study' | 'theory' | 'lab' | 'deadline' | 'results' | 'semester_start' | 'special' | 'bridge_day';
  status?: string;
  courseId?: string;
  courseName?: string;
  courseColor?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  description?: string;
  allDay?: boolean;
}

export interface SmartSuggestion {
  id: string;
  title: string;
  type: 'study_block' | 'exam_prep' | 'assignment_work';
  date: Date;
  startTime: string;
  endTime: string;
  relatedTo?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface CalendarFilters {
  courses: string[];
  types: string[];
  showHolidays: boolean;
  showStudyBlocks: boolean;
}
