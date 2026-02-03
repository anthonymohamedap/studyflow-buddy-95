import { useMemo } from 'react';
import { 
  format, 
  startOfDay, 
  addDays, 
  parseISO, 
  isSameDay,
  isToday,
  isBefore,
  differenceInDays
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  Clock, 
  MapPin, 
  CalendarDays, 
  AlertTriangle,
  CheckCircle2,
  Circle,
  PlayCircle
} from 'lucide-react';
import { getEventsForDate, isHoliday } from '@/data/academicCalendar';
import type { ExpandedCalendarEvent } from '@/hooks/useDbCalendarEvents';
import type { Database } from '@/integrations/supabase/types';

type Exercise = Database['public']['Tables']['exercises']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type Deliverable = Database['public']['Tables']['deliverables']['Row'];

interface AgendaViewProps {
  selectedDate: Date;
  exercises?: Exercise[];
  project?: Project | null;
  deliverables?: Deliverable[];
  dbEvents?: ExpandedCalendarEvent[];
  daysToShow?: number;
  onAddDbEvent?: (date: Date, time?: string) => void;
  onEditDbEvent?: (event: ExpandedCalendarEvent) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  theory: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-700 dark:text-blue-300', icon: '📚' },
  lab: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', icon: '🔬' },
  group: { bg: 'bg-teal-500/20', border: 'border-teal-500', text: 'text-teal-700 dark:text-teal-300', icon: '👥' },
  project: { bg: 'bg-violet-500/20', border: 'border-violet-500', text: 'text-violet-700 dark:text-violet-300', icon: '📁' },
  assignment: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-700 dark:text-orange-300', icon: '📝' },
  deadline: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-700 dark:text-red-300', icon: '⚠️' },
  exam: { bg: 'bg-rose-600/20', border: 'border-rose-600', text: 'text-rose-700 dark:text-rose-300', icon: '📋' },
  study: { bg: 'bg-slate-500/20', border: 'border-slate-500', text: 'text-slate-700 dark:text-slate-300', icon: '📖' },
  personal: { bg: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-700 dark:text-cyan-300', icon: '🏠' },
  holiday: { bg: 'bg-muted', border: 'border-muted-foreground/30', text: 'text-muted-foreground', icon: '🎉' },
  exercise: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-700 dark:text-orange-300', icon: '📝' },
  deliverable: { bg: 'bg-violet-500/20', border: 'border-violet-500', text: 'text-violet-700 dark:text-violet-300', icon: '📦' },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  NOT_STARTED: <Circle className="h-4 w-4 text-muted-foreground" />,
  IN_PROGRESS: <PlayCircle className="h-4 w-4 text-blue-500" />,
  DONE: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  NEEDS_REVIEW: <AlertTriangle className="h-4 w-4 text-amber-500" />,
};

interface AgendaItem {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  category: string;
  date: Date;
  endDate?: Date;
  allDay: boolean;
  location?: string | null;
  color?: string | null;
  status?: string;
  isDbEvent: boolean;
  originalEvent?: ExpandedCalendarEvent;
}

export function AgendaView({
  selectedDate,
  exercises = [],
  project,
  deliverables = [],
  dbEvents = [],
  daysToShow = 14,
  onAddDbEvent,
  onEditDbEvent
}: AgendaViewProps) {
  // Generate list of days
  const days = useMemo(() => {
    return Array.from({ length: daysToShow }, (_, i) => addDays(selectedDate, i));
  }, [selectedDate, daysToShow]);

  // Build agenda items for each day
  const agendaByDay = useMemo(() => {
    const result: Map<string, AgendaItem[]> = new Map();

    days.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const items: AgendaItem[] = [];
      const dayStart = startOfDay(day);

      // Add database events
      dbEvents.forEach(event => {
        const eventDayStart = startOfDay(event.start_date);
        const eventDayEnd = startOfDay(event.end_date);
        if (dayStart >= eventDayStart && dayStart <= eventDayEnd) {
          items.push({
            id: event.id,
            title: event.title,
            description: event.description,
            type: event.event_type,
            category: event.category,
            date: event.start_date,
            endDate: event.end_date,
            allDay: event.all_day,
            location: event.location,
            color: event.color,
            isDbEvent: true,
            originalEvent: event
          });
        }
      });

      // Add exercise deadlines
      exercises.forEach(ex => {
        if (ex.deadline && isSameDay(parseISO(ex.deadline), day)) {
          items.push({
            id: ex.id,
            title: ex.title,
            description: ex.description,
            type: 'deadline',
            category: 'exercise',
            date: parseISO(ex.deadline),
            allDay: true,
            status: ex.status,
            isDbEvent: false
          });
        }
      });

      // Add project deadline
      if (project?.deadline && isSameDay(parseISO(project.deadline), day)) {
        items.push({
          id: project.id,
          title: project.title,
          description: project.description,
          type: 'deadline',
          category: 'project',
          date: parseISO(project.deadline),
          allDay: true,
          status: project.status,
          isDbEvent: false
        });
      }

      // Add deliverable deadlines
      deliverables.forEach(del => {
        if (del.deadline && isSameDay(parseISO(del.deadline), day)) {
          items.push({
            id: del.id,
            title: del.title,
            type: 'deadline',
            category: 'deliverable',
            date: parseISO(del.deadline),
            allDay: true,
            status: del.completed ? 'DONE' : 'NOT_STARTED',
            isDbEvent: false
          });
        }
      });

      // Sort by time (all-day first, then by start time)
      items.sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return a.date.getTime() - b.date.getTime();
      });

      result.set(dayKey, items);
    });

    return result;
  }, [days, dbEvents, exercises, project, deliverables]);

  const getCategoryStyle = (category: string) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.personal;
  };

  const getRelativeDay = (date: Date): string => {
    const today = startOfDay(new Date());
    const target = startOfDay(date);
    const diff = differenceInDays(target, today);
    
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff <= 7) return `In ${diff} days`;
    return format(date, 'EEEE');
  };

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Agenda
          </CardTitle>
          <Badge variant="outline">{daysToShow} days</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="divide-y">
            {days.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const items = agendaByDay.get(dayKey) || [];
              const academicEvents = getEventsForDate(day);
              const holiday = isHoliday(day);
              const today = isToday(day);
              const past = isBefore(day, startOfDay(new Date()));

              return (
                <div 
                  key={dayKey}
                  className={cn(
                    "p-4",
                    holiday && "bg-muted/30",
                    today && "bg-primary/5",
                    past && "opacity-60"
                  )}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-lg flex flex-col items-center justify-center",
                        today ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        <span className="text-xs font-medium">{format(day, 'EEE')}</span>
                        <span className="text-lg font-bold">{format(day, 'd')}</span>
                      </div>
                      <div>
                        <div className="font-medium">{getRelativeDay(day)}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(day, 'MMMM yyyy')}
                        </div>
                      </div>
                    </div>
                    {onAddDbEvent && !past && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onAddDbEvent(day)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Academic Events / Holidays */}
                  {academicEvents.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {academicEvents.map(event => (
                        <Badge 
                          key={event.id}
                          variant="secondary"
                          className={cn(getCategoryStyle(event.type).bg, getCategoryStyle(event.type).text)}
                        >
                          {getCategoryStyle(event.type).icon} {event.title}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Items */}
                  {items.length === 0 && academicEvents.length === 0 && (
                    <div className="text-sm text-muted-foreground italic">
                      No events scheduled
                    </div>
                  )}

                  <div className="space-y-2">
                    {items.map(item => {
                      const style = getCategoryStyle(item.category);
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "p-3 rounded-lg border-l-4 transition-all",
                            style.bg,
                            item.isDbEvent && "cursor-pointer hover:shadow-md"
                          )}
                          style={{ borderLeftColor: item.color || undefined }}
                          onClick={() => {
                            if (item.isDbEvent && item.originalEvent) {
                              onEditDbEvent?.(item.originalEvent);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className={cn("font-medium", style.text)}>
                                {style.icon} {item.title}
                              </div>
                              {item.description && (
                                <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {item.description}
                                </div>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                {!item.allDay && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(item.date, 'HH:mm')}
                                    {item.endDate && ` - ${format(item.endDate, 'HH:mm')}`}
                                  </span>
                                )}
                                {item.allDay && (
                                  <Badge variant="outline" className="text-xs">All Day</Badge>
                                )}
                                {item.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {item.location}
                                  </span>
                                )}
                              </div>
                            </div>
                            {item.status && STATUS_ICONS[item.status]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}