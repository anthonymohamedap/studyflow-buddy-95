import { useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO
} from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  ACADEMIC_EVENTS,
  EVENT_COLORS,
  isHoliday,
  isExamPeriod,
  getEventsForDate
} from '@/data/academicCalendar';
import type { Database } from '@/integrations/supabase/types';

type Exercise = Database['public']['Tables']['exercises']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type Deliverable = Database['public']['Tables']['deliverables']['Row'];

interface MonthViewProps {
  selectedDate: Date;
  exercises?: Exercise[];
  project?: Project | null;
  deliverables?: Deliverable[];
  onDateSelect?: (date: Date) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MonthView({ 
  selectedDate, 
  exercises = [], 
  project, 
  deliverables = [],
  onDateSelect 
}: MonthViewProps) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Build map of events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Array<{ id: string; title: string; type: string; status?: string }>>();
    
    // Add exercise deadlines
    exercises.forEach(ex => {
      if (ex.deadline) {
        const dateKey = ex.deadline.split('T')[0];
        const existing = map.get(dateKey) || [];
        existing.push({ id: ex.id, title: ex.title, type: 'exercise', status: ex.status });
        map.set(dateKey, existing);
      }
    });
    
    // Add project deadline
    if (project?.deadline) {
      const dateKey = project.deadline.split('T')[0];
      const existing = map.get(dateKey) || [];
      existing.push({ id: project.id, title: project.title, type: 'project', status: project.status });
      map.set(dateKey, existing);
    }
    
    // Add deliverable deadlines
    deliverables.forEach(del => {
      if (del.deadline) {
        const dateKey = del.deadline.split('T')[0];
        const existing = map.get(dateKey) || [];
        existing.push({ id: del.id, title: del.title, type: 'deliverable', status: del.completed ? 'completed' : 'pending' });
        map.set(dateKey, existing);
      }
    });
    
    return map;
  }, [exercises, project, deliverables]);

  const getTypeColor = (type: string) => {
    return EVENT_COLORS[type as keyof typeof EVENT_COLORS] || EVENT_COLORS.theory;
  };

  return (
    <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {WEEKDAYS.map((day) => (
          <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const isCurrentMonth = isSameMonth(day, selectedDate);
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const dayHoliday = isHoliday(day);
          const dayExam = isExamPeriod(day);
          const academicEvents = getEventsForDate(day);
          const userEvents = eventsByDate.get(dateKey) || [];
          const allEvents = [...academicEvents.map(e => ({ ...e, type: e.type })), ...userEvents];
          
          return (
            <div
              key={i}
              className={cn(
                "min-h-[100px] p-2 border-b border-r cursor-pointer transition-colors",
                !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                isSelected && "bg-primary/5 ring-2 ring-primary ring-inset",
                isTodayDate && "bg-primary/10",
                dayHoliday && "bg-muted/40",
                dayExam && "bg-rose-50 dark:bg-rose-950/20",
                "hover:bg-muted/30"
              )}
              onClick={() => onDateSelect?.(day)}
            >
              {/* Date number */}
              <div className={cn(
                "text-sm font-medium mb-1",
                isTodayDate && "text-primary font-bold",
                !isCurrentMonth && "text-muted-foreground/50"
              )}>
                {format(day, 'd')}
              </div>

              {/* Events */}
              <div className="space-y-0.5">
                {allEvents.slice(0, 3).map((event, idx) => {
                  const colors = getTypeColor(event.type);
                  return (
                    <div
                      key={`${event.id}-${idx}`}
                      className={cn(
                        "text-xs p-0.5 px-1 rounded truncate",
                        colors.bg,
                        colors.text
                      )}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  );
                })}
                {allEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground pl-1">
                    +{allEvents.length - 3} more
                  </div>
                )}
              </div>

              {/* Dot indicators for more subtle view */}
              {allEvents.length === 0 && academicEvents.length === 0 && dayHoliday && (
                <div className="text-xs text-muted-foreground italic">Holiday</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="p-3 border-t bg-muted/10 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", EVENT_COLORS.exam.solid)} />
          <span className="text-xs text-muted-foreground">Exam Period</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", EVENT_COLORS.holiday.solid)} />
          <span className="text-xs text-muted-foreground">Holiday</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", EVENT_COLORS.deadline.solid)} />
          <span className="text-xs text-muted-foreground">Deadline</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", EVENT_COLORS.semester_start.solid)} />
          <span className="text-xs text-muted-foreground">Semester</span>
        </div>
      </div>
    </div>
  );
}
