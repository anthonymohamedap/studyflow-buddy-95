import { useMemo } from 'react';
import { 
  format, 
  startOfYear, 
  endOfYear, 
  eachMonthOfInterval,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isToday,
  isSameDay
} from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  ACADEMIC_EVENTS,
  ACADEMIC_YEAR_2025_2026,
  EVENT_COLORS,
  isHoliday,
  isExamPeriod
} from '@/data/academicCalendar';
import { Badge } from '@/components/ui/badge';

interface YearViewProps {
  selectedDate: Date;
  onDateSelect?: (date: Date) => void;
  onMonthSelect?: (date: Date) => void;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function YearView({ selectedDate, onDateSelect, onMonthSelect }: YearViewProps) {
  // Get academic year months (Sep 2025 - Aug 2026)
  const academicYearMonths = useMemo(() => {
    const startDate = new Date('2025-09-01');
    const endDate = new Date('2026-08-31');
    return eachMonthOfInterval({ start: startDate, end: endDate });
  }, []);

  // Group events by month for quick badge display
  const eventsByMonth = useMemo(() => {
    const map = new Map<string, typeof ACADEMIC_EVENTS>();
    ACADEMIC_EVENTS.forEach(event => {
      const monthKey = event.startDate.substring(0, 7); // YYYY-MM
      const existing = map.get(monthKey) || [];
      existing.push(event);
      map.set(monthKey, existing);
    });
    return map;
  }, []);

  return (
    <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
      <div className="p-4 border-b bg-muted/30">
        <h3 className="font-semibold">Academic Year 2025-2026</h3>
        <p className="text-sm text-muted-foreground">Department Media, Design & IT</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
        {academicYearMonths.map((month) => {
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);
          const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
          const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
          const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
          const monthKey = format(month, 'yyyy-MM');
          const monthEvents = eventsByMonth.get(monthKey) || [];
          
          // Check if this month has exam period
          const hasExams = monthEvents.some(e => e.type === 'exam_period');
          const hasHolidays = monthEvents.some(e => e.type === 'holiday');

          return (
            <div 
              key={monthKey}
              className={cn(
                "border rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-md",
                hasExams && "ring-1 ring-rose-300 dark:ring-rose-700"
              )}
              onClick={() => onMonthSelect?.(month)}
            >
              {/* Month header */}
              <div className={cn(
                "p-2 text-center font-medium text-sm",
                hasExams ? "bg-rose-100 dark:bg-rose-900/30" : "bg-muted/50"
              )}>
                {format(month, 'MMMM yyyy')}
                {hasExams && (
                  <Badge variant="destructive" className="ml-2 text-[10px] py-0">
                    Exams
                  </Badge>
                )}
              </div>

              {/* Mini calendar */}
              <div className="p-1">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 text-center mb-0.5">
                  {WEEKDAYS.map((day, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground font-medium">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-[1px]">
                  {days.map((day, i) => {
                    const isCurrentMonth = isSameMonth(day, month);
                    const isTodayDate = isToday(day);
                    const dayHoliday = isHoliday(day);
                    const dayExam = isExamPeriod(day);
                    const isSelectedDay = isSameDay(day, selectedDate);

                    return (
                      <div
                        key={i}
                        className={cn(
                          "text-center text-[10px] p-0.5 rounded-sm",
                          !isCurrentMonth && "text-muted-foreground/30",
                          isCurrentMonth && "text-foreground",
                          isTodayDate && "bg-primary text-primary-foreground font-bold",
                          dayHoliday && !isTodayDate && "bg-muted text-muted-foreground",
                          dayExam && !isTodayDate && "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300",
                          isSelectedDay && !isTodayDate && "ring-1 ring-primary"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCurrentMonth) onDateSelect?.(day);
                        }}
                      >
                        {format(day, 'd')}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Key events for this month */}
              {monthEvents.length > 0 && (
                <div className="px-2 pb-2 space-y-0.5">
                  {monthEvents.slice(0, 2).map((event) => {
                    const colors = EVENT_COLORS[event.type as keyof typeof EVENT_COLORS] || EVENT_COLORS.special;
                    return (
                      <div 
                        key={event.id}
                        className={cn(
                          "text-[10px] px-1 py-0.5 rounded truncate",
                          colors.bg,
                          colors.text
                        )}
                        title={event.title}
                      >
                        {event.titleNL || event.title}
                      </div>
                    );
                  })}
                  {monthEvents.length > 2 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{monthEvents.length - 2} more events
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Academic year overview */}
      <div className="p-4 border-t bg-muted/10">
        <h4 className="font-medium text-sm mb-2">Key Dates</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {ACADEMIC_EVENTS
            .filter(e => ['semester_start', 'exam_period', 'results'].includes(e.type))
            .slice(0, 6)
            .map((event) => {
              const colors = EVENT_COLORS[event.type as keyof typeof EVENT_COLORS];
              return (
                <div 
                  key={event.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg",
                    colors.bg
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full", colors.solid)} />
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-xs font-medium truncate", colors.text)}>
                      {event.titleNL || event.title}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {format(new Date(event.startDate), 'dd MMM yyyy')}
                      {event.endDate && ` - ${format(new Date(event.endDate), 'dd MMM')}`}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
