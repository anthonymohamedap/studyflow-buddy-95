import { useMemo } from 'react';
import { format, isSameDay, parseISO, addDays, isBefore, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  Clock, 
  FileText, 
  AlertTriangle,
  Lightbulb,
  Brain
} from 'lucide-react';
import { 
  SAMPLE_WEEKLY_SCHEDULE,
  isExamPeriod,
  isHoliday,
  ACADEMIC_EVENTS
} from '@/data/academicCalendar';
import type { SmartSuggestion } from '@/types/calendar';
import type { Database } from '@/integrations/supabase/types';

type Exercise = Database['public']['Tables']['exercises']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type Deliverable = Database['public']['Tables']['deliverables']['Row'];

interface SmartPlannerProps {
  selectedDate: Date;
  exercises?: Exercise[];
  project?: Project | null;
  deliverables?: Deliverable[];
}

export function SmartPlanner({ 
  selectedDate, 
  exercises = [], 
  project, 
  deliverables = [] 
}: SmartPlannerProps) {
  
  // Generate smart suggestions
  const suggestions = useMemo(() => {
    const result: SmartSuggestion[] = [];
    const today = new Date();
    const dayOfWeek = selectedDate.getDay();
    
    // Skip weekends for study suggestions
    if (dayOfWeek === 0 || dayOfWeek === 6) return result;
    
    // Check if it's a holiday
    if (isHoliday(selectedDate)) return result;

    // Get scheduled blocks for this day
    const dayBlocks = SAMPLE_WEEKLY_SCHEDULE.filter(
      block => block.dayOfWeek === (dayOfWeek === 0 ? 7 : dayOfWeek)
    );
    
    // Find free afternoon slots (after 14:00)
    const afternoonBlocks = dayBlocks.filter(b => parseInt(b.startTime) >= 14);
    const hasAfternoonClasses = afternoonBlocks.length > 0;
    
    if (!hasAfternoonClasses) {
      // Suggest study time in the afternoon
      result.push({
        id: `study-${format(selectedDate, 'yyyy-MM-dd')}`,
        title: 'Free Study Block',
        type: 'study_block',
        date: selectedDate,
        startTime: '14:00',
        endTime: '17:00',
        priority: 'low'
      });
    }

    // Check for upcoming deadlines and suggest prep work
    const upcomingExercises = exercises.filter(ex => {
      if (!ex.deadline || ex.status === 'DONE') return false;
      const deadline = parseISO(ex.deadline);
      const daysUntil = Math.ceil((deadline.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil > 0 && daysUntil <= 7;
    });

    upcomingExercises.forEach(ex => {
      const deadline = parseISO(ex.deadline!);
      const daysUntil = Math.ceil((deadline.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      result.push({
        id: `prep-${ex.id}`,
        title: `Work on: ${ex.title}`,
        type: 'assignment_work',
        date: selectedDate,
        startTime: hasAfternoonClasses ? '17:30' : '14:00',
        endTime: hasAfternoonClasses ? '19:00' : '16:00',
        relatedTo: ex.title,
        priority: daysUntil <= 2 ? 'high' : daysUntil <= 4 ? 'medium' : 'low'
      });
    });

    // Check for upcoming project deliverables
    deliverables.filter(d => !d.completed && d.deadline).forEach(del => {
      const deadline = parseISO(del.deadline!);
      const daysUntil = Math.ceil((deadline.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntil > 0 && daysUntil <= 7) {
        result.push({
          id: `del-${del.id}`,
          title: `Project: ${del.title}`,
          type: 'assignment_work',
          date: selectedDate,
          startTime: '15:00',
          endTime: '17:00',
          relatedTo: project?.title,
          priority: daysUntil <= 2 ? 'high' : 'medium'
        });
      }
    });

    // Exam preparation suggestions
    if (isExamPeriod(selectedDate)) {
      result.push({
        id: `exam-prep-${format(selectedDate, 'yyyy-MM-dd')}`,
        title: 'Exam Preparation',
        type: 'exam_prep',
        date: selectedDate,
        startTime: '09:00',
        endTime: '12:00',
        priority: 'high'
      });
    }

    // Check if exam period is approaching
    const examEvents = ACADEMIC_EVENTS.filter(e => e.type === 'exam_period');
    examEvents.forEach(exam => {
      const examStart = new Date(exam.startDate);
      const daysUntilExam = Math.ceil((examStart.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExam > 0 && daysUntilExam <= 14) {
        result.push({
          id: `exam-prep-advance-${exam.id}`,
          title: `Prepare for ${exam.title}`,
          type: 'exam_prep',
          date: selectedDate,
          startTime: '16:00',
          endTime: '18:00',
          priority: daysUntilExam <= 7 ? 'high' : 'medium'
        });
      }
    });

    // Sort by priority
    return result.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }).slice(0, 5); // Limit to 5 suggestions
  }, [selectedDate, exercises, deliverables, project]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'medium': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'low': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'study_block': return <BookOpen className="h-4 w-4" />;
      case 'exam_prep': return <Brain className="h-4 w-4" />;
      case 'assignment_work': return <FileText className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  if (suggestions.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No suggestions for this day</p>
        <p className="text-xs">{isHoliday(selectedDate) ? 'Enjoy your break!' : 'Check back on a weekday'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h4 className="font-medium">Smart Suggestions</h4>
        <Badge variant="secondary" className="text-xs">
          {suggestions.length}
        </Badge>
      </div>

      {suggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className={cn(
            "p-3 rounded-lg border transition-colors hover:shadow-sm cursor-pointer",
            getPriorityColor(suggestion.priority)
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {getTypeIcon(suggestion.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{suggestion.title}</div>
              <div className="text-xs opacity-75 mt-0.5">
                {suggestion.startTime} - {suggestion.endTime}
              </div>
              {suggestion.relatedTo && (
                <div className="text-xs opacity-60 mt-1">
                  Related to: {suggestion.relatedTo}
                </div>
              )}
            </div>
            {suggestion.priority === 'high' && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
          </div>
        </div>
      ))}

      <p className="text-xs text-muted-foreground mt-4">
        💡 Suggestions are based on your schedule, upcoming deadlines, and academic calendar.
      </p>
    </div>
  );
}
