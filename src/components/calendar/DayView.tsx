import { useMemo } from 'react';
import { format, isSameDay, startOfDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Clock, MapPin, CalendarOff, AlertCircle } from 'lucide-react';
import { 
  isHoliday, 
  getEventsForDate,
  type ScheduleBlock 
} from '@/data/academicCalendar';
import type { ExpandedCalendarEvent } from '@/hooks/useDbCalendarEvents';
import type { Database } from '@/integrations/supabase/types';

type Exercise = Database['public']['Tables']['exercises']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type Deliverable = Database['public']['Tables']['deliverables']['Row'];

interface DayViewProps {
  selectedDate: Date;
  exercises?: Exercise[];
  project?: Project | null;
  deliverables?: Deliverable[];
  scheduleBlocks?: ScheduleBlock[];
  dbEvents?: ExpandedCalendarEvent[];
  onAddDbEvent?: (date: Date, time?: string) => void;
  onEditDbEvent?: (event: ExpandedCalendarEvent) => void;
}

const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  theory: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-700 dark:text-blue-300' },
  lab: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
  group: { bg: 'bg-teal-500/20', border: 'border-teal-500', text: 'text-teal-700 dark:text-teal-300' },
  project: { bg: 'bg-violet-500/20', border: 'border-violet-500', text: 'text-violet-700 dark:text-violet-300' },
  assignment: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-700 dark:text-orange-300' },
  deadline: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-700 dark:text-red-300' },
  exam: { bg: 'bg-rose-600/20', border: 'border-rose-600', text: 'text-rose-700 dark:text-rose-300' },
  study: { bg: 'bg-slate-500/20', border: 'border-slate-500', text: 'text-slate-700 dark:text-slate-300' },
  personal: { bg: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-700 dark:text-cyan-300' },
  holiday: { bg: 'bg-muted', border: 'border-muted-foreground/30', text: 'text-muted-foreground' },
};

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-muted text-muted-foreground',
  IN_PROGRESS: 'bg-blue-500/20 text-blue-700',
  DONE: 'bg-emerald-500/20 text-emerald-700',
  NEEDS_REVIEW: 'bg-amber-500/20 text-amber-700',
};

export function DayView({
  selectedDate,
  exercises = [],
  project,
  deliverables = [],
  scheduleBlocks = [],
  dbEvents = [],
  onAddDbEvent,
  onEditDbEvent
}: DayViewProps) {
  const isVacationDay = isHoliday(selectedDate);
  const academicEvents = getEventsForDate(selectedDate);
  const isToday = isSameDay(selectedDate, new Date());
  const dayOfWeek = selectedDate.getDay();

  // Get schedule blocks for this day
  const daySchedule = useMemo(() => {
    if (isVacationDay) return [];
    return scheduleBlocks.filter(block => block.dayOfWeek === dayOfWeek);
  }, [scheduleBlocks, dayOfWeek, isVacationDay]);

  // Get events for this day
  const dayEvents = useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    return dbEvents.filter(event => {
      const eventDayStart = startOfDay(event.start_date);
      const eventDayEnd = startOfDay(event.end_date);
      return dayStart >= eventDayStart && dayStart <= eventDayEnd;
    });
  }, [dbEvents, selectedDate]);

  // Get deadlines for this day
  const deadlines = useMemo(() => {
    const items: Array<{ id: string; title: string; type: string; status?: string }> = [];
    
    exercises.forEach(ex => {
      if (ex.deadline && isSameDay(parseISO(ex.deadline), selectedDate)) {
        items.push({ id: ex.id, title: ex.title, type: 'exercise', status: ex.status });
      }
    });
    
    if (project?.deadline && isSameDay(parseISO(project.deadline), selectedDate)) {
      items.push({ id: project.id, title: project.title, type: 'project', status: project.status });
    }
    
    deliverables.forEach(del => {
      if (del.deadline && isSameDay(parseISO(del.deadline), selectedDate)) {
        items.push({ id: del.id, title: del.title, type: 'deliverable', status: del.completed ? 'DONE' : 'NOT_STARTED' });
      }
    });
    
    return items;
  }, [exercises, project, deliverables, selectedDate]);

  // All-day events
  const allDayEvents = dayEvents.filter(e => e.all_day);
  const timedEvents = dayEvents.filter(e => !e.all_day);

  const getEventStyle = (event: ExpandedCalendarEvent) => {
    const startHour = event.start_date.getHours();
    const startMin = event.start_date.getMinutes();
    const endHour = event.end_date.getHours();
    const endMin = event.end_date.getMinutes();
    
    const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    const heightPx = Math.max((duration / 60) * 60, 30);
    const topOffset = startMin;
    
    return { height: `${heightPx}px`, marginTop: `${topOffset}px` };
  };

  const getScheduleStyle = (block: ScheduleBlock) => {
    const startHour = parseInt(block.startTime.split(':')[0]);
    const startMin = parseInt(block.startTime.split(':')[1]);
    const endHour = parseInt(block.endTime.split(':')[0]);
    const endMin = parseInt(block.endTime.split(':')[1]);
    
    const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    const heightPx = (duration / 60) * 60;
    const topOffset = startMin;
    
    return { height: `${heightPx}px`, marginTop: `${topOffset}px` };
  };

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.personal;
  };

  const getEventsForSlot = (time: string) => {
    const hour = parseInt(time.split(':')[0]);
    return timedEvents.filter(event => {
      const startHour = event.start_date.getHours();
      const endHour = event.end_date.getHours();
      return hour >= startHour && hour < endHour;
    });
  };

  const getScheduleForSlot = (time: string) => {
    const hour = parseInt(time.split(':')[0]);
    return daySchedule.filter(block => {
      const startHour = parseInt(block.startTime.split(':')[0]);
      const endHour = parseInt(block.endTime.split(':')[0]);
      return hour >= startHour && hour < endHour;
    });
  };

  return (
    <Card className="shadow-soft">
      <CardContent className="p-0">
        {/* Day Header */}
        <div className={cn(
          "p-4 border-b",
          isVacationDay && "bg-muted/50",
          isToday && "bg-primary/5"
        )}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={cn(
                "text-2xl font-bold",
                isToday && "text-primary"
              )}>
                {format(selectedDate, 'EEEE')}
              </h2>
              <p className="text-muted-foreground">
                {format(selectedDate, 'MMMM d, yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isVacationDay && (
                <Badge variant="secondary" className="gap-1">
                  <CalendarOff className="h-3 w-3" />
                  Holiday
                </Badge>
              )}
              {onAddDbEvent && (
                <Button size="sm" onClick={() => onAddDbEvent(selectedDate)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Event
                </Button>
              )}
            </div>
          </div>

          {/* Academic Events */}
          {academicEvents.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {academicEvents.map(event => (
                <Badge 
                  key={event.id} 
                  variant="outline"
                  className={cn(getCategoryColor(event.type).bg, getCategoryColor(event.type).text)}
                >
                  {event.title}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Deadlines Section */}
        {deadlines.length > 0 && (
          <div className="p-4 border-b bg-red-50/50 dark:bg-red-950/20">
            <h3 className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4" />
              Deadlines
            </h3>
            <div className="space-y-2">
              {deadlines.map(item => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between p-2 bg-card rounded-lg border"
                >
                  <span className="font-medium">{item.title}</span>
                  <Badge className={STATUS_COLORS[item.status || 'NOT_STARTED']}>
                    {item.status?.replace('_', ' ') || 'Not Started'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All-Day Events */}
        {allDayEvents.length > 0 && (
          <div className="p-4 border-b bg-muted/30">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">All Day</h3>
            <div className="space-y-1">
              {allDayEvents.map(event => {
                const colors = getCategoryColor(event.category);
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "p-2 rounded-lg cursor-pointer hover:shadow-sm transition-shadow border-l-4",
                      colors.bg,
                      colors.text
                    )}
                    style={{ borderLeftColor: event.color || undefined }}
                    onClick={() => onEditDbEvent?.(event)}
                  >
                    <div className="font-medium">{event.title}</div>
                    {event.location && (
                      <div className="text-xs flex items-center gap-1 mt-1 opacity-75">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Time Grid */}
        <div className="divide-y max-h-[600px] overflow-y-auto">
          {TIME_SLOTS.map(time => {
            const hour = parseInt(time.split(':')[0]);
            const slotEvents = getEventsForSlot(time);
            const slotSchedule = getScheduleForSlot(time);
            const showEvents = slotEvents.filter(e => e.start_date.getHours() === hour);
            const showSchedule = slotSchedule.filter(b => parseInt(b.startTime.split(':')[0]) === hour);
            
            return (
              <div 
                key={time} 
                className="flex min-h-[60px] group hover:bg-muted/30 transition-colors"
              >
                <div className="w-16 p-2 text-xs text-muted-foreground text-right border-r flex-shrink-0">
                  {time}
                </div>
                <div className="flex-1 p-1 relative">
                  {/* Schedule blocks */}
                  {showSchedule.map(block => {
                    const style = getScheduleStyle(block);
                    return (
                      <div
                        key={block.id}
                        className={cn(
                          "absolute left-1 right-1 rounded-lg p-2 border-l-4 z-10",
                          getCategoryColor(block.type).bg,
                          getCategoryColor(block.type).text
                        )}
                        style={style}
                      >
                        <div className="font-medium text-sm">{block.courseName}</div>
                        <div className="text-xs opacity-75">
                          {block.startTime} - {block.endTime}
                        </div>
                        {block.room && (
                          <div className="text-xs flex items-center gap-1 mt-1 opacity-75">
                            <MapPin className="h-3 w-3" />
                            {block.room}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Database events */}
                  {showEvents.map(event => {
                    const style = getEventStyle(event);
                    const colors = getCategoryColor(event.category);
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "absolute left-1 right-1 rounded-lg p-2 border-l-4 cursor-pointer hover:shadow-md transition-shadow z-20",
                          colors.bg,
                          colors.text
                        )}
                        style={{
                          ...style,
                          borderLeftColor: event.color || undefined
                        }}
                        onClick={() => onEditDbEvent?.(event)}
                      >
                        <div className="font-medium text-sm">{event.title}</div>
                        <div className="text-xs opacity-75 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(event.start_date, 'HH:mm')} - {format(event.end_date, 'HH:mm')}
                        </div>
                        {event.location && (
                          <div className="text-xs flex items-center gap-1 mt-1 opacity-75">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add event button on hover */}
                  {onAddDbEvent && slotEvents.length === 0 && showSchedule.length === 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute inset-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onAddDbEvent(selectedDate, time)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}