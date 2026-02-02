import { useState, useMemo } from 'react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addDays,
  isSameDay,
  parseISO,
  differenceInDays,
  startOfDay
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, CalendarOff } from 'lucide-react';
import { 
  ACADEMIC_EVENTS,
  EVENT_COLORS,
  isHoliday,
  isExamPeriod,
  getEventsForDate,
  type ScheduleBlock,
} from '@/data/academicCalendar';
import type { CalendarEvent } from '@/types/calendar';
import type { ExpandedCalendarEvent } from '@/hooks/useDbCalendarEvents';
import type { Database } from '@/integrations/supabase/types';

type Exercise = Database['public']['Tables']['exercises']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type Deliverable = Database['public']['Tables']['deliverables']['Row'];

interface WeekViewProps {
  selectedDate: Date;
  exercises?: Exercise[];
  project?: Project | null;
  deliverables?: Deliverable[];
  onDateSelect?: (date: Date) => void;
  courseFilter?: string[];
  scheduleBlocks?: ScheduleBlock[];
  onAddEvent?: (day: number, time: string) => void;
  onEditEvent?: (event: ScheduleBlock) => void;
  // New props for database events
  dbEvents?: ExpandedCalendarEvent[];
  onAddDbEvent?: (date: Date, time?: string) => void;
  onEditDbEvent?: (event: ExpandedCalendarEvent) => void;
}

const TIME_SLOTS = Array.from({ length: 13 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`);
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Category to color mapping
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; solid: string }> = {
  theory: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-700 dark:text-blue-300', solid: 'bg-blue-500' },
  lab: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', solid: 'bg-emerald-500' },
  group: { bg: 'bg-teal-500/20', border: 'border-teal-500', text: 'text-teal-700 dark:text-teal-300', solid: 'bg-teal-500' },
  project: { bg: 'bg-violet-500/20', border: 'border-violet-500', text: 'text-violet-700 dark:text-violet-300', solid: 'bg-violet-500' },
  assignment: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-700 dark:text-orange-300', solid: 'bg-orange-500' },
  deadline: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-700 dark:text-red-300', solid: 'bg-red-500' },
  exam: { bg: 'bg-rose-600/20', border: 'border-rose-600', text: 'text-rose-700 dark:text-rose-300', solid: 'bg-rose-600' },
  study: { bg: 'bg-slate-500/20', border: 'border-slate-500', text: 'text-slate-700 dark:text-slate-300', solid: 'bg-slate-500' },
  personal: { bg: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-700 dark:text-cyan-300', solid: 'bg-cyan-500' },
  holiday: { bg: 'bg-muted', border: 'border-muted-foreground/30', text: 'text-muted-foreground', solid: 'bg-muted-foreground/50' },
};

export function WeekView({ 
  selectedDate, 
  exercises = [], 
  project, 
  deliverables = [],
  onDateSelect,
  courseFilter,
  scheduleBlocks = [],
  onAddEvent,
  onEditEvent,
  dbEvents = [],
  onAddDbEvent,
  onEditDbEvent
}: WeekViewProps) {
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekEnd, -1) }); // Mon-Sat

  // Filter schedule blocks by course if filter is applied, and exclude vacation days
  const filteredSchedule = useMemo(() => {
    let filtered = scheduleBlocks;
    
    if (courseFilter && courseFilter.length > 0) {
      filtered = filtered.filter(block => 
        courseFilter.some(c => block.courseName.toLowerCase().includes(c.toLowerCase()))
      );
    }
    
    return filtered;
  }, [scheduleBlocks, courseFilter]);

  // Get schedule for a specific day, respecting vacation periods
  const getScheduleForDay = (dayDate: Date, dayIndex: number): ScheduleBlock[] => {
    if (isHoliday(dayDate)) {
      return [];
    }
    return filteredSchedule.filter(block => block.dayOfWeek === dayIndex + 1);
  };

  // Get database events for a day
  const getDbEventsForDay = (dayDate: Date): ExpandedCalendarEvent[] => {
    const dayStart = startOfDay(dayDate);
    return dbEvents.filter(event => {
      const eventDayStart = startOfDay(event.start_date);
      const eventDayEnd = startOfDay(event.end_date);
      return dayStart >= eventDayStart && dayStart <= eventDayEnd;
    });
  };

  // Build multi-day event spans for the week
  const multiDayEvents = useMemo(() => {
    const spans: Array<{
      event: ExpandedCalendarEvent;
      startDayIndex: number;
      endDayIndex: number;
      row: number;
    }> = [];

    const multiDay = dbEvents.filter(event => {
      const startDay = startOfDay(event.start_date);
      const endDay = startOfDay(event.end_date);
      return startDay.getTime() !== endDay.getTime() && event.all_day;
    });

    // Assign rows to avoid overlapping
    const usedRows: Record<number, number[]> = {};
    
    multiDay.forEach(event => {
      const eventStart = startOfDay(event.start_date);
      const eventEnd = startOfDay(event.end_date);
      
      // Find which days this event spans in this week
      let startDayIndex = -1;
      let endDayIndex = -1;
      
      weekDays.forEach((day, index) => {
        const dayStart = startOfDay(day);
        if (dayStart >= eventStart && dayStart <= eventEnd) {
          if (startDayIndex === -1) startDayIndex = index;
          endDayIndex = index;
        }
      });

      if (startDayIndex !== -1) {
        // Find available row
        let row = 0;
        let rowAvailable = false;
        while (!rowAvailable) {
          rowAvailable = true;
          for (let i = startDayIndex; i <= endDayIndex; i++) {
            if (usedRows[i]?.includes(row)) {
              rowAvailable = false;
              break;
            }
          }
          if (!rowAvailable) row++;
        }

        // Mark row as used
        for (let i = startDayIndex; i <= endDayIndex; i++) {
          if (!usedRows[i]) usedRows[i] = [];
          usedRows[i].push(row);
        }

        spans.push({ event, startDayIndex, endDayIndex, row });
      }
    });

    return spans;
  }, [dbEvents, weekDays]);

  const maxMultiDayRows = Math.max(0, ...multiDayEvents.map(s => s.row)) + 1;

  // Build events for the week (from exercises, projects, deliverables)
  const weekEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    exercises.forEach(ex => {
      if (ex.deadline) {
        const deadlineDate = parseISO(ex.deadline);
        if (deadlineDate >= weekStart && deadlineDate <= weekEnd) {
          events.push({
            id: ex.id,
            title: ex.title,
            date: deadlineDate,
            type: 'exercise',
            status: ex.status,
            allDay: true
          });
        }
      }
    });

    if (project?.deadline) {
      const deadlineDate = parseISO(project.deadline);
      if (deadlineDate >= weekStart && deadlineDate <= weekEnd) {
        events.push({
          id: project.id,
          title: project.title,
          date: deadlineDate,
          type: 'project',
          status: project.status,
          allDay: true
        });
      }
    }

    deliverables.forEach(del => {
      if (del.deadline) {
        const deadlineDate = parseISO(del.deadline);
        if (deadlineDate >= weekStart && deadlineDate <= weekEnd) {
          events.push({
            id: del.id,
            title: del.title,
            date: deadlineDate,
            type: 'deliverable',
            status: del.completed ? 'completed' : 'pending',
            allDay: true
          });
        }
      }
    });

    return events;
  }, [exercises, project, deliverables, weekStart, weekEnd]);

  // Get block height based on duration
  const getBlockStyle = (block: ScheduleBlock) => {
    const startHour = parseInt(block.startTime.split(':')[0]);
    const startMin = parseInt(block.startTime.split(':')[1]);
    const endHour = parseInt(block.endTime.split(':')[0]);
    const endMin = parseInt(block.endTime.split(':')[1]);
    
    const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    const heightPx = (duration / 60) * 48;
    const topOffset = startMin * (48 / 60);
    
    return { height: `${heightPx}px`, marginTop: `${topOffset}px` };
  };

  // Get DB event style based on time
  const getDbEventStyle = (event: ExpandedCalendarEvent) => {
    const startHour = event.start_date.getHours();
    const startMin = event.start_date.getMinutes();
    const endHour = event.end_date.getHours();
    const endMin = event.end_date.getMinutes();
    
    const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    const heightPx = Math.max((duration / 60) * 48, 24);
    const topOffset = startMin * (48 / 60);
    
    return { height: `${heightPx}px`, marginTop: `${topOffset}px` };
  };

  const isStartSlot = (block: ScheduleBlock, time: string): boolean => {
    const hour = parseInt(time.split(':')[0]);
    const blockStartHour = parseInt(block.startTime.split(':')[0]);
    return hour === blockStartHour;
  };

  const isDbEventStartSlot = (event: ExpandedCalendarEvent, time: string): boolean => {
    const hour = parseInt(time.split(':')[0]);
    return event.start_date.getHours() === hour;
  };

  const getBlocksForSlot = (dayBlocks: ScheduleBlock[], time: string): ScheduleBlock[] => {
    const hour = parseInt(time.split(':')[0]);
    return dayBlocks.filter(block => {
      const blockStartHour = parseInt(block.startTime.split(':')[0]);
      const blockEndHour = parseInt(block.endTime.split(':')[0]);
      return hour >= blockStartHour && hour < blockEndHour;
    });
  };

  const getDbEventsForSlot = (dayEvents: ExpandedCalendarEvent[], time: string): ExpandedCalendarEvent[] => {
    const hour = parseInt(time.split(':')[0]);
    return dayEvents.filter(event => {
      if (event.all_day) return false;
      const startHour = event.start_date.getHours();
      const endHour = event.end_date.getHours();
      return hour >= startHour && hour < endHour;
    });
  };

  const getTypeColor = (type: string) => {
    return CATEGORY_COLORS[type] || EVENT_COLORS[type as keyof typeof EVENT_COLORS] || CATEGORY_COLORS.personal;
  };

  return (
    <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
      {/* Header with days */}
      <div className="grid grid-cols-[60px_repeat(6,1fr)] border-b bg-muted/30">
        <div className="p-2 text-xs text-muted-foreground font-medium"></div>
        {weekDays.map((day, i) => {
          const dayHoliday = isHoliday(day);
          const dayExam = isExamPeriod(day);
          const isToday = isSameDay(day, new Date());
          const academicEvents = getEventsForDate(day);
          
          return (
            <div 
              key={i} 
              className={cn(
                "p-3 text-center border-l cursor-pointer hover:bg-muted/50 transition-colors relative",
                dayHoliday && "bg-muted/50",
                dayExam && "bg-rose-50 dark:bg-rose-950/20",
                isToday && "bg-primary/5"
              )}
              onClick={() => onDateSelect?.(day)}
            >
              <div className="text-xs font-medium text-muted-foreground">{DAYS[i]}</div>
              <div className={cn(
                "text-lg font-bold",
                isToday && "text-primary"
              )}>
                {format(day, 'd')}
              </div>
              <div className="text-xs text-muted-foreground">{format(day, 'MMM')}</div>
              
              {dayHoliday && (
                <div className="absolute top-1 right-1">
                  <CalendarOff className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
              
              {academicEvents.length > 0 && (
                <div className="mt-1 flex justify-center gap-0.5">
                  {academicEvents.slice(0, 2).map((event) => (
                    <div 
                      key={event.id}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        getTypeColor(event.type).solid
                      )}
                      title={event.title}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Multi-day events row */}
      {multiDayEvents.length > 0 && (
        <div 
          className="grid grid-cols-[60px_repeat(6,1fr)] border-b bg-muted/10 relative"
          style={{ minHeight: `${maxMultiDayRows * 28 + 8}px` }}
        >
          <div className="p-2 text-xs text-muted-foreground font-medium flex items-start justify-center">
            Multi-day
          </div>
          {weekDays.map((_, i) => (
            <div key={i} className="border-l relative" />
          ))}
          
          {/* Render multi-day event bars */}
          {multiDayEvents.map(({ event, startDayIndex, endDayIndex, row }) => {
            const colors = getTypeColor(event.category);
            const colWidth = 100 / 6; // Each column is 1/6 of the remaining space
            const left = `calc(60px + ${startDayIndex * colWidth}% - ${startDayIndex * 10}px)`;
            const width = `calc(${(endDayIndex - startDayIndex + 1) * colWidth}% - ${(endDayIndex - startDayIndex + 1) * 10}px)`;
            
            return (
              <div
                key={event.id}
                className={cn(
                  "absolute rounded px-2 py-0.5 text-xs font-medium truncate cursor-pointer hover:shadow-md transition-shadow border-l-2",
                  colors.bg,
                  colors.text
                )}
                style={{
                  left: `calc(60px + ${startDayIndex * (100/6)}%)`,
                  width: `calc(${(endDayIndex - startDayIndex + 1) * (100/6)}% - 4px)`,
                  top: `${row * 28 + 4}px`,
                  height: '24px',
                  borderLeftColor: event.color || 'currentColor'
                }}
                onClick={() => onEditDbEvent?.(event)}
                title={`${event.title} (${format(event.start_date, 'MMM d')} - ${format(event.end_date, 'MMM d')})`}
              >
                {event.title}
              </div>
            );
          })}
        </div>
      )}

      {/* All-day events row (single-day all-day events + deadlines from exercises) */}
      {(weekEvents.length > 0 || dbEvents.some(e => e.all_day && isSameDay(e.start_date, e.end_date))) && (
        <div className="grid grid-cols-[60px_repeat(6,1fr)] border-b bg-muted/10">
          <div className="p-2 text-xs text-muted-foreground font-medium flex items-center justify-center">
            All Day
          </div>
          {weekDays.map((day, i) => {
            const dayEvents = weekEvents.filter(e => isSameDay(e.date, day));
            const singleDayAllDayEvents = dbEvents.filter(e => 
              e.all_day && 
              isSameDay(e.start_date, day) && 
              isSameDay(e.start_date, e.end_date)
            );
            
            return (
              <div key={i} className="p-1 border-l min-h-[40px]">
                {dayEvents.map(event => (
                  <div 
                    key={event.id}
                    className={cn(
                      "text-xs p-1 rounded mb-0.5 truncate",
                      getTypeColor(event.type).bg,
                      getTypeColor(event.type).text
                    )}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {singleDayAllDayEvents.map(event => (
                  <div 
                    key={event.id}
                    className={cn(
                      "text-xs p-1 rounded mb-0.5 truncate cursor-pointer hover:shadow-sm",
                      getTypeColor(event.category).bg,
                      getTypeColor(event.category).text
                    )}
                    style={event.color ? { borderLeft: `3px solid ${event.color}` } : undefined}
                    onClick={() => onEditDbEvent?.(event)}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="overflow-y-auto max-h-[600px]">
        <div className="grid grid-cols-[60px_repeat(6,1fr)]">
          {/* Time column */}
          <div className="divide-y">
            {TIME_SLOTS.map((time) => (
              <div key={time} className="h-12 p-1 text-xs text-muted-foreground text-right pr-2 flex items-start justify-end">
                {time}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIndex) => {
            const dayHoliday = isHoliday(day);
            const dayExam = isExamPeriod(day);
            const renderedBlocks = new Set<string>();
            const renderedDbEvents = new Set<string>();
            const dayBlocks = getScheduleForDay(day, dayIndex);
            const dayDbEvents = getDbEventsForDay(day).filter(e => !e.all_day);
            const holidayEvent = getEventsForDate(day).find(e => e.type === 'holiday' || e.type === 'bridge_day');

            return (
              <div 
                key={dayIndex} 
                className={cn(
                  "border-l divide-y relative",
                  dayHoliday && "bg-muted/30",
                  dayExam && "bg-rose-50/50 dark:bg-rose-950/10"
                )}
              >
                {/* Holiday overlay */}
                {dayHoliday && holidayEvent && (
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <div className="bg-muted/80 dark:bg-muted/60 px-3 py-2 rounded-lg shadow-sm text-center">
                      <CalendarOff className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">
                        {holidayEvent.titleNL || holidayEvent.title}
                      </p>
                    </div>
                  </div>
                )}
                
                {TIME_SLOTS.map((time) => {
                  const blocks = getBlocksForSlot(dayBlocks, time);
                  const dbEventsInSlot = getDbEventsForSlot(dayDbEvents, time);
                  const slotKey = `${dayIndex}-${time}`;
                  const isHovered = hoveredSlot === slotKey;
                  
                  return (
                    <div 
                      key={time} 
                      className={cn(
                        "h-12 relative group",
                        !dayHoliday && "cursor-pointer hover:bg-muted/20"
                      )}
                      onMouseEnter={() => !dayHoliday && setHoveredSlot(slotKey)}
                      onMouseLeave={() => setHoveredSlot(null)}
                      onClick={() => {
                        if (!dayHoliday && blocks.length === 0 && dbEventsInSlot.length === 0) {
                          if (onAddDbEvent) {
                            onAddDbEvent(day, time);
                          } else if (onAddEvent) {
                            onAddEvent(dayIndex + 1, time);
                          }
                        }
                      }}
                    >
                      {/* Add button on hover for empty slots */}
                      {isHovered && blocks.length === 0 && dbEventsInSlot.length === 0 && (onAddEvent || onAddDbEvent) && !dayHoliday && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 opacity-60 hover:opacity-100"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      
                      {/* Schedule blocks */}
                      {blocks.map((block) => {
                        if (!isStartSlot(block, time) || renderedBlocks.has(block.id)) {
                          return null;
                        }
                        renderedBlocks.add(block.id);
                        const style = getBlockStyle(block);
                        const colors = getTypeColor(block.type);

                        return (
                          <div
                            key={block.id}
                            className={cn(
                              "absolute left-0.5 right-0.5 rounded-md p-1.5 overflow-hidden z-10 border-l-3 group/block",
                              colors.bg,
                              colors.border,
                              "cursor-pointer hover:shadow-md transition-shadow"
                            )}
                            style={{
                              height: style.height,
                              borderLeftWidth: '3px'
                            }}
                            title={`${block.courseName} (${block.startTime} - ${block.endTime})`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditEvent?.(block);
                            }}
                          >
                            {onEditEvent && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-0.5 right-0.5 h-5 w-5 p-0 opacity-0 group-hover/block:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditEvent(block);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            
                            <div className={cn("text-xs font-semibold truncate", colors.text)}>
                              {block.courseCode}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {block.courseName}
                            </div>
                            {block.room && (
                              <div className="text-xs text-muted-foreground truncate">
                                {block.room}
                              </div>
                            )}
                            <Badge 
                              variant="outline" 
                              className={cn("text-[10px] mt-0.5 capitalize", colors.text)}
                            >
                              {block.type}
                            </Badge>
                          </div>
                        );
                      })}

                      {/* Database events (timed) */}
                      {dbEventsInSlot.map((event) => {
                        if (!isDbEventStartSlot(event, time) || renderedDbEvents.has(event.id)) {
                          return null;
                        }
                        renderedDbEvents.add(event.id);
                        const style = getDbEventStyle(event);
                        const colors = getTypeColor(event.category);

                        return (
                          <div
                            key={event.id}
                            className={cn(
                              "absolute left-0.5 right-0.5 rounded-md p-1.5 overflow-hidden z-10 group/block",
                              colors.bg,
                              "cursor-pointer hover:shadow-md transition-shadow"
                            )}
                            style={{
                              height: style.height,
                              borderLeftWidth: '3px',
                              borderLeftColor: event.color || 'currentColor',
                              borderLeftStyle: 'solid'
                            }}
                            title={`${event.title} (${format(event.start_date, 'HH:mm')} - ${format(event.end_date, 'HH:mm')})`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditDbEvent?.(event);
                            }}
                          >
                            {onEditDbEvent && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-0.5 right-0.5 h-5 w-5 p-0 opacity-0 group-hover/block:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditDbEvent(event);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            
                            <div className={cn("text-xs font-semibold truncate", colors.text)}>
                              {event.title}
                            </div>
                            {event.location && (
                              <div className="text-xs text-muted-foreground truncate">
                                {event.location}
                              </div>
                            )}
                            <Badge 
                              variant="outline" 
                              className={cn("text-[10px] mt-0.5 capitalize", colors.text)}
                            >
                              {event.category}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="p-3 border-t bg-muted/10 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", CATEGORY_COLORS.theory.solid)} />
          <span className="text-xs text-muted-foreground">Theory</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", CATEGORY_COLORS.lab.solid)} />
          <span className="text-xs text-muted-foreground">Lab</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", CATEGORY_COLORS.assignment.solid)} />
          <span className="text-xs text-muted-foreground">Assignment</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", CATEGORY_COLORS.deadline.solid)} />
          <span className="text-xs text-muted-foreground">Deadline</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", CATEGORY_COLORS.exam.solid)} />
          <span className="text-xs text-muted-foreground">Exam</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", CATEGORY_COLORS.personal.solid)} />
          <span className="text-xs text-muted-foreground">Personal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", CATEGORY_COLORS.holiday.solid)} />
          <span className="text-xs text-muted-foreground">Holiday</span>
        </div>
      </div>
    </div>
  );
}
