import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, differenceInDays, isToday, isSameMonth } from 'date-fns';
import { 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  AlertTriangle,
  Calendar,
  BookOpen,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTimelineData, TimelineZoom, TimelineEvent, OverloadWarning } from '@/hooks/useTimelineData';
import { cn } from '@/lib/utils';

const EVENT_ICONS = {
  exercise: BookOpen,
  project: FolderKanban,
  lab: FlaskConical,
  deadline: Clock,
  exam: GraduationCap,
  holiday: Calendar,
  lesson: BookOpen,
};

const EVENT_COLORS = {
  exercise: 'bg-blue-500',
  project: 'bg-violet-500',
  lab: 'bg-emerald-500',
  deadline: 'bg-orange-500',
  exam: 'bg-rose-500',
  holiday: 'bg-muted',
  lesson: 'bg-cyan-500',
};

export function TimelineView() {
  const [zoom, setZoom] = useState<TimelineZoom>('semester');
  const [filterCourses, setFilterCourses] = useState<string[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  
  const {
    courses,
    timelinePeriods,
    semesterBounds,
    upcomingCritical,
    courseColorMap,
  } = useTimelineData(zoom, filterCourses, filterTypes);

  const zoomLevels: TimelineZoom[] = ['semester', 'month', 'week'];
  const currentZoomIndex = zoomLevels.indexOf(zoom);

  const handleZoomIn = () => {
    if (currentZoomIndex < zoomLevels.length - 1) {
      setZoom(zoomLevels[currentZoomIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    if (currentZoomIndex > 0) {
      setZoom(zoomLevels[currentZoomIndex - 1]);
    }
  };

  const toggleCourseFilter = (courseId: string) => {
    setFilterCourses(prev => 
      prev.includes(courseId) 
        ? prev.filter(c => c !== courseId)
        : [...prev, courseId]
    );
  };

  const toggleTypeFilter = (type: string) => {
    setFilterTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const eventTypes = ['exercise', 'project', 'lab', 'deadline', 'exam', 'lesson'];

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{semesterBounds.label} Timeline</h2>
          <p className="text-muted-foreground text-sm">
            {format(semesterBounds.start, 'MMM d, yyyy')} — {format(semesterBounds.end, 'MMM d, yyyy')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center bg-secondary rounded-lg p-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleZoomOut}
              disabled={currentZoomIndex === 0}
              className="h-8 w-8 p-0"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm font-medium capitalize min-w-[80px] text-center">
              {zoom}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleZoomIn}
              disabled={currentZoomIndex === zoomLevels.length - 1}
              className="h-8 w-8 p-0"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Filters */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {(filterCourses.length > 0 || filterTypes.length > 0) && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                    {filterCourses.length + filterTypes.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-4">
                {/* Course filters */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Courses</h4>
                  <div className="space-y-2">
                    {courses.map(course => (
                      <label 
                        key={course.id} 
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={filterCourses.length === 0 || filterCourses.includes(course.id)}
                          onCheckedChange={() => toggleCourseFilter(course.id)}
                        />
                        <span 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: `var(--course-${courseColorMap[course.id]})` }}
                        />
                        <span className="truncate">{course.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Type filters */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Event Types</h4>
                  <div className="space-y-2">
                    {eventTypes.map(type => {
                      const Icon = EVENT_ICONS[type as keyof typeof EVENT_ICONS];
                      return (
                        <label 
                          key={type} 
                          className="flex items-center gap-2 text-sm cursor-pointer capitalize"
                        >
                          <Checkbox
                            checked={filterTypes.length === 0 || filterTypes.includes(type)}
                            onCheckedChange={() => toggleTypeFilter(type)}
                          />
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span>{type}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Clear filters */}
                {(filterCourses.length > 0 || filterTypes.length > 0) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      setFilterCourses([]);
                      setFilterTypes([]);
                    }}
                  >
                    Clear all filters
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Overload warnings */}
      <AnimatePresence>
        {upcomingCritical.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {upcomingCritical.length} important {upcomingCritical.length === 1 ? 'event' : 'events'} coming up
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {upcomingCritical.slice(0, 3).map(e => e.title).join(', ')}
                      {upcomingCritical.length > 3 && ` and ${upcomingCritical.length - 3} more`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      <Card className="shadow-soft overflow-hidden">
        <ScrollArea className="w-full">
          <div className="min-w-[800px] p-6">
            {/* Timeline header */}
            <div className="flex border-b pb-4 mb-4">
              {timelinePeriods.map((period, index) => (
                <div 
                  key={index}
                  className={cn(
                    "flex-1 text-center px-2",
                    index < timelinePeriods.length - 1 && "border-r"
                  )}
                >
                  <div className="font-medium text-sm">{period.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {period.events.length} {period.events.length === 1 ? 'event' : 'events'}
                  </div>
                  {period.overloadWarning && (
                    <OverloadBadge warning={period.overloadWarning} />
                  )}
                </div>
              ))}
            </div>

            {/* Timeline content */}
            <div className="flex min-h-[300px]">
              {timelinePeriods.map((period, periodIndex) => (
                <TimelinePeriodColumn 
                  key={periodIndex}
                  period={period}
                  isLast={periodIndex === timelinePeriods.length - 1}
                  courseColorMap={courseColorMap}
                />
              ))}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {Object.entries(EVENT_ICONS).map(([type, Icon]) => (
          <div key={type} className="flex items-center gap-1.5 capitalize">
            <div className={cn("w-3 h-3 rounded-full", EVENT_COLORS[type as keyof typeof EVENT_COLORS])} />
            <span>{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelinePeriodColumn({ 
  period, 
  isLast,
  courseColorMap 
}: { 
  period: { events: TimelineEvent[]; start: Date; end: Date; label: string };
  isLast: boolean;
  courseColorMap: Record<string, string>;
}) {
  const today = new Date();
  const isCurrentPeriod = period.start <= today && period.end >= today;

  return (
    <div 
      className={cn(
        "flex-1 px-2 relative",
        !isLast && "border-r",
        isCurrentPeriod && "bg-primary/5 -mx-2 px-4 rounded-lg"
      )}
    >
      {isCurrentPeriod && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6">
          <Badge variant="default" className="text-xs">Today</Badge>
        </div>
      )}
      
      <div className="space-y-2">
        <TooltipProvider>
          {period.events.map((event, eventIndex) => (
            <Tooltip key={event.id}>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: eventIndex * 0.05 }}
                  className={cn(
                    "p-2 rounded-lg text-xs cursor-pointer transition-all hover:scale-105",
                    "border-l-4",
                    event.courseColor 
                      ? `border-l-course-${event.courseColor}` 
                      : "border-l-muted-foreground"
                  )}
                  style={{
                    backgroundColor: `hsl(var(--${event.type === 'exam' ? 'destructive' : 'muted'}) / 0.3)`
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const Icon = EVENT_ICONS[event.type];
                      return <Icon className="h-3 w-3 flex-shrink-0" />;
                    })()}
                    <span className="truncate font-medium">{event.title}</span>
                  </div>
                  {event.courseName && (
                    <div className="text-muted-foreground truncate mt-0.5">
                      {event.courseName}
                    </div>
                  )}
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {event.type} • {format(event.startDate, 'PPP')}
                  </p>
                  {event.courseName && (
                    <p className="text-xs">{event.courseName}</p>
                  )}
                  {event.status && (
                    <Badge variant="outline" className="text-xs">
                      {event.status.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>

        {period.events.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8 italic">
            No events
          </div>
        )}
      </div>
    </div>
  );
}

function OverloadBadge({ warning }: { warning: OverloadWarning }) {
  const severityColors = {
    low: 'bg-muted text-muted-foreground',
    medium: 'bg-warning/20 text-warning-foreground',
    high: 'bg-destructive/20 text-destructive',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mt-1",
            severityColors[warning.severity]
          )}>
            <AlertTriangle className="h-3 w-3" />
            <span>{warning.eventCount}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{warning.message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
