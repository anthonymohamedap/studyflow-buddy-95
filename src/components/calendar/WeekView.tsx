import { useState, useMemo } from 'react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addDays,
  isSameDay,
  parseISO
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
  type AcademicEvent
} from '@/data/academicCalendar';
import type { CalendarEvent } from '@/types/calendar';
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
}

const TIME_SLOTS = Array.from({ length: 13 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`);
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function WeekView({ 
  selectedDate, 
  exercises = [], 
  project, 
  deliverables = [],
  onDateSelect,
  courseFilter,
  scheduleBlocks = [],
  onAddEvent,
  onEditEvent
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
    // If it's a holiday, return empty (no courses during vacation)
    if (isHoliday(dayDate)) {
      return [];
    }
    
    return filteredSchedule.filter(block => block.dayOfWeek === dayIndex + 1);
  };

  // Build events for the week
  const weekEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    // Add exercise deadlines
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

    // Add project deadline
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

    // Add deliverable deadlines
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
    const heightPx = (duration / 60) * 48; // 48px per hour
    const topOffset = startMin * (48 / 60);
    
    return { height: `${heightPx}px`, marginTop: `${topOffset}px` };
  };

  // Check if this is the start slot for a block
  const isStartSlot = (block: ScheduleBlock, time: string): boolean => {
    const hour = parseInt(time.split(':')[0]);
    const blockStartHour = parseInt(block.startTime.split(':')[0]);
    return hour === blockStartHour;
  };

  // Get schedule blocks for a specific day and time
  const getBlocksForSlot = (dayBlocks: ScheduleBlock[], time: string): ScheduleBlock[] => {
    const hour = parseInt(time.split(':')[0]);
    return dayBlocks.filter(block => {
      const blockStartHour = parseInt(block.startTime.split(':')[0]);
      const blockEndHour = parseInt(block.endTime.split(':')[0]);
      return hour >= blockStartHour && hour < blockEndHour;
    });
  };

  const getTypeColor = (type: string) => {
    return EVENT_COLORS[type as keyof typeof EVENT_COLORS] || EVENT_COLORS.theory;
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
              
              {/* Holiday indicator */}
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

      {/* All-day events row */}
      {weekEvents.length > 0 && (
        <div className="grid grid-cols-[60px_repeat(6,1fr)] border-b bg-muted/10">
          <div className="p-2 text-xs text-muted-foreground font-medium flex items-center justify-center">
            All Day
          </div>
          {weekDays.map((day, i) => {
            const dayEvents = weekEvents.filter(e => isSameDay(e.date, day));
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
            const dayBlocks = getScheduleForDay(day, dayIndex);
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
                        if (!dayHoliday && blocks.length === 0 && onAddEvent) {
                          onAddEvent(dayIndex + 1, time);
                        }
                      }}
                    >
                      {/* Add button on hover for empty slots */}
                      {isHovered && blocks.length === 0 && onAddEvent && !dayHoliday && (
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
                      
                      {blocks.map((block) => {
                        // Only render at the start slot
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
                            {/* Edit button */}
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
          <div className={cn("w-3 h-3 rounded", EVENT_COLORS.theory.solid)} />
          <span className="text-xs text-muted-foreground">Theory</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", EVENT_COLORS.lab.solid)} />
          <span className="text-xs text-muted-foreground">Lab</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", EVENT_COLORS.group.solid)} />
          <span className="text-xs text-muted-foreground">Group</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", EVENT_COLORS.deadline.solid)} />
          <span className="text-xs text-muted-foreground">Deadline</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", EVENT_COLORS.exam.solid)} />
          <span className="text-xs text-muted-foreground">Exam</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded", EVENT_COLORS.holiday.solid)} />
          <span className="text-xs text-muted-foreground">Holiday</span>
        </div>
      </div>
    </div>
  );
}
