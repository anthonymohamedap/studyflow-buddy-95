import { useMemo } from 'react';
import { format, isSameDay, parseISO, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  EVENT_COLORS,
  getEventsForDate,
  isHoliday,
  isExamPeriod,
  getSemesterWeek
} from '@/data/academicCalendar';
import type { Database } from '@/integrations/supabase/types';

type Exercise = Database['public']['Tables']['exercises']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type Deliverable = Database['public']['Tables']['deliverables']['Row'];

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect?: (date: Date) => void;
  exercises?: Exercise[];
  project?: Project | null;
  deliverables?: Deliverable[];
}

export function MiniCalendar({ 
  selectedDate, 
  onDateSelect,
  exercises = [],
  project,
  deliverables = []
}: MiniCalendarProps) {
  const today = new Date();
  const { semester, week } = getSemesterWeek(today);

  // Get upcoming deadlines (next 7 days)
  const upcomingDeadlines = useMemo(() => {
    const deadlines: Array<{ id: string; title: string; date: Date; type: string }> = [];
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    exercises.forEach(ex => {
      if (ex.deadline && ex.status !== 'DONE') {
        const date = parseISO(ex.deadline);
        if (date >= now && date <= weekFromNow) {
          deadlines.push({ id: ex.id, title: ex.title, date, type: 'exercise' });
        }
      }
    });

    if (project?.deadline && project.status !== 'SUBMITTED') {
      const date = parseISO(project.deadline);
      if (date >= now && date <= weekFromNow) {
        deadlines.push({ id: project.id, title: project.title, date, type: 'project' });
      }
    }

    deliverables.forEach(del => {
      if (del.deadline && !del.completed) {
        const date = parseISO(del.deadline);
        if (date >= now && date <= weekFromNow) {
          deadlines.push({ id: del.id, title: del.title, date, type: 'deliverable' });
        }
      }
    });

    return deadlines.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 3);
  }, [exercises, project, deliverables]);

  // Get today's academic events
  const todayEvents = getEventsForDate(today);
  const isTodayHoliday = isHoliday(today);
  const isTodayExam = isExamPeriod(today);

  return (
    <div className="bg-card rounded-xl border shadow-soft p-4 space-y-4">
      {/* Current info */}
      <div className="text-center">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">
          {format(today, 'EEEE')}
        </div>
        <div className="text-4xl font-bold text-primary">
          {format(today, 'd')}
        </div>
        <div className="text-sm text-muted-foreground">
          {format(today, 'MMMM yyyy')}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Semester {semester} • Week {week}
        </div>
      </div>

      {/* Today's status */}
      {(isTodayHoliday || isTodayExam || todayEvents.length > 0) && (
        <div className="space-y-1">
          {isTodayHoliday && (
            <div className={cn(
              "text-xs p-1.5 rounded text-center",
              EVENT_COLORS.holiday.bg,
              EVENT_COLORS.holiday.text
            )}>
              🎉 Holiday
            </div>
          )}
          {isTodayExam && (
            <div className={cn(
              "text-xs p-1.5 rounded text-center",
              EVENT_COLORS.exam.bg,
              EVENT_COLORS.exam.text
            )}>
              📝 Exam Period
            </div>
          )}
          {todayEvents.map(event => (
            <div 
              key={event.id}
              className={cn(
                "text-xs p-1.5 rounded text-center",
                EVENT_COLORS[event.type as keyof typeof EVENT_COLORS]?.bg || EVENT_COLORS.special.bg,
                EVENT_COLORS[event.type as keyof typeof EVENT_COLORS]?.text || EVENT_COLORS.special.text
              )}
            >
              {event.titleNL || event.title}
            </div>
          ))}
        </div>
      )}

      {/* Upcoming deadlines */}
      {upcomingDeadlines.length > 0 && (
        <div className="border-t pt-3">
          <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Upcoming
          </div>
          <div className="space-y-2">
            {upcomingDeadlines.map((deadline) => {
              const daysUntil = Math.ceil((deadline.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const isUrgent = daysUntil <= 2;
              const colors = EVENT_COLORS[deadline.type as keyof typeof EVENT_COLORS] || EVENT_COLORS.deadline;
              
              return (
                <div
                  key={deadline.id}
                  className={cn(
                    "flex items-center gap-2 text-xs p-2 rounded cursor-pointer transition-colors",
                    isUrgent ? "bg-red-50 dark:bg-red-950/20" : "hover:bg-muted/50"
                  )}
                  onClick={() => onDateSelect?.(deadline.date)}
                >
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", colors.solid)} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{deadline.title}</div>
                    <div className="text-muted-foreground">
                      {format(deadline.date, 'EEE, MMM d')}
                    </div>
                  </div>
                  <div className={cn(
                    "text-xs font-medium",
                    isUrgent && "text-red-600 dark:text-red-400"
                  )}>
                    {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick dots for the week */}
      <div className="border-t pt-3">
        <div className="flex justify-between">
          {Array.from({ length: 7 }, (_, i) => {
            const day = new Date(today);
            day.setDate(today.getDate() - today.getDay() + i + 1); // Start from Monday
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const hasEvent = getEventsForDate(day).length > 0 || 
              upcomingDeadlines.some(d => isSameDay(d.date, day));
            
            return (
              <div
                key={i}
                className={cn(
                  "flex flex-col items-center cursor-pointer p-1 rounded transition-colors",
                  isSelected && "bg-primary/10",
                  !isSelected && "hover:bg-muted/50"
                )}
                onClick={() => onDateSelect?.(day)}
              >
                <div className="text-[10px] text-muted-foreground">
                  {format(day, 'EEE')[0]}
                </div>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                  isTodayDate && "bg-primary text-primary-foreground font-bold",
                  isSelected && !isTodayDate && "ring-1 ring-primary"
                )}>
                  {format(day, 'd')}
                </div>
                {hasEvent && (
                  <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
