import { useState, useCallback, useMemo } from 'react';
import { 
  format, 
  addWeeks, 
  subWeeks, 
  addMonths, 
  subMonths,
  addYears,
  subYears,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  setHours,
  setMinutes
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  ChevronLeft, 
  ChevronRight,
  Calendar as CalendarIcon,
  Maximize2,
  Minimize2,
  Download,
  Smartphone,
  Filter,
  SlidersHorizontal,
  BookOpen,
  FlaskConical,
  FolderKanban,
  Clock,
  GraduationCap,
  Plus,
  Loader2,
  Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { YearView } from './YearView';
import { MiniCalendar } from './MiniCalendar';
import { SmartPlanner } from './SmartPlanner';
import { CalendarEventDialog, type CalendarEventFormData } from './CalendarEventDialog';
import { EnhancedEventDialog } from './EnhancedEventDialog';
import { GoogleCalendarConnect } from './GoogleCalendarConnect';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useDbCalendarEvents, type ExpandedCalendarEvent, type CalendarEventFormData as DbEventFormData } from '@/hooks/useDbCalendarEvents';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ACADEMIC_EVENTS,
  getSemesterWeek,
  type ScheduleBlock
} from '@/data/academicCalendar';
import type { CalendarViewMode } from '@/types/calendar';
import type { Database } from '@/integrations/supabase/types';

type Exercise = Database['public']['Tables']['exercises']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type Deliverable = Database['public']['Tables']['deliverables']['Row'];
type Course = Database['public']['Tables']['courses']['Row'];

interface SmartCalendarProps {
  courses?: Course[];
  exercises?: Exercise[];
  project?: Project | null;
  deliverables?: Deliverable[];
  defaultExpanded?: boolean;
}

export function SmartCalendar({ 
  courses = [],
  exercises = [], 
  project, 
  deliverables = [],
  defaultExpanded = true 
}: SmartCalendarProps) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [showSmartPlanner, setShowSmartPlanner] = useState(true);
  const [showGoogleConnect, setShowGoogleConnect] = useState(false);
  
  // Google Calendar hook
  const { 
    isConnected: isGoogleConnected, 
    isCheckingConnection: isCheckingGoogle,
    connect: connectGoogle,
    isConnecting: isGoogleConnecting
  } = useGoogleCalendar();
  
  // Legacy CRUD dialog state (for schedule blocks)
  const [legacyDialogOpen, setLegacyDialogOpen] = useState(false);
  const [selectedScheduleEvent, setSelectedScheduleEvent] = useState<ScheduleBlock | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | undefined>();
  
  // New database event dialog state
  const [dbEventDialogOpen, setDbEventDialogOpen] = useState(false);
  const [selectedDbEvent, setSelectedDbEvent] = useState<ExpandedCalendarEvent | null>(null);
  const [selectedEventDate, setSelectedEventDate] = useState<Date | undefined>();
  const [selectedEventTime, setSelectedEventTime] = useState<string | undefined>();
  
  // Legacy calendar events hook (for schedule blocks)
  const { scheduleBlocks, saveEvent: saveLegacyEvent, deleteEvent: deleteLegacyEvent } = useCalendarEvents();
  
  // Calculate date range for database query
  const dateRange = useMemo(() => {
    const start = viewMode === 'year' 
      ? new Date('2025-09-01')
      : viewMode === 'month' 
        ? startOfMonth(selectedDate)
        : startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = viewMode === 'year'
      ? new Date('2026-09-01')
      : viewMode === 'month'
        ? endOfMonth(selectedDate)
        : endOfWeek(selectedDate, { weekStartsOn: 1 });
    return { start, end };
  }, [selectedDate, viewMode]);
  
  // Database calendar events hook
  const { 
    expandedEvents: dbEvents,
    isLoading: isLoadingEvents,
    saveEvent: saveDbEvent,
    deleteEvent: deleteDbEvent,
    isCreating,
    isUpdating,
    isDeleting
  } = useDbCalendarEvents(dateRange.start, dateRange.end);

  const { semester, week } = getSemesterWeek(selectedDate);

  // Navigation
  const navigate = useCallback((direction: 'prev' | 'next') => {
    setSelectedDate(prev => {
      switch (viewMode) {
        case 'week':
          return direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1);
        case 'month':
          return direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1);
        case 'year':
          return direction === 'next' ? addYears(prev, 1) : subYears(prev, 1);
        default:
          return prev;
      }
    });
  }, [viewMode]);

  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  // Generate ICS for all deadlines
  const generateICS = useCallback(() => {
    const events: Array<{ id: string; title: string; date: string; endDate?: string; allDay?: boolean }> = [];
    
    exercises.forEach(ex => {
      if (ex.deadline) {
        events.push({ id: ex.id, title: ex.title, date: ex.deadline, allDay: true });
      }
    });
    
    if (project?.deadline) {
      events.push({ id: project.id, title: project.title, date: project.deadline, allDay: true });
    }
    
    deliverables.forEach(del => {
      if (del.deadline) {
        events.push({ id: del.id, title: del.title, date: del.deadline, allDay: true });
      }
    });

    // Add academic events
    ACADEMIC_EVENTS.forEach(event => {
      events.push({ 
        id: event.id, 
        title: event.titleNL || event.title, 
        date: event.startDate,
        endDate: event.endDate,
        allDay: true
      });
    });

    // Add database events
    dbEvents.forEach(event => {
      events.push({
        id: event.id,
        title: event.title,
        date: event.start_date.toISOString(),
        endDate: event.end_date.toISOString(),
        allDay: event.all_day
      });
    });

    const icsEvents = events.map((event) => {
      const startDate = new Date(event.date);
      const endDate = event.endDate ? new Date(event.endDate) : startDate;
      
      if (event.allDay) {
        const dateStr = format(startDate, "yyyyMMdd");
        const endDateStr = format(endDate, "yyyyMMdd");
        return `BEGIN:VEVENT
UID:${event.id}@studyflow
DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}
DTSTART;VALUE=DATE:${dateStr}
DTEND;VALUE=DATE:${endDateStr}
SUMMARY:${event.title}
END:VEVENT`;
      } else {
        return `BEGIN:VEVENT
UID:${event.id}@studyflow
DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}
DTSTART:${format(startDate, "yyyyMMdd'T'HHmmss")}
DTEND:${format(endDate, "yyyyMMdd'T'HHmmss")}
SUMMARY:${event.title}
END:VEVENT`;
      }
    }).join('\n');

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//StudyFlow//Academic Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:StudyFlow Academic Calendar
${icsEvents}
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'studyflow_calendar.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Calendar downloaded! Open it to add to your calendar app.');
  }, [exercises, project, deliverables, dbEvents]);

  // Get view title
  const getViewTitle = () => {
    switch (viewMode) {
      case 'week':
        const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
        return `${format(weekStart, 'd MMM')} - ${format(weekEnd, 'd MMM yyyy')}`;
      case 'month':
        return format(selectedDate, 'MMMM yyyy');
      case 'year':
        return 'Academic Year 2025-2026';
      default:
        return '';
    }
  };

  // Handle adding a new database event
  const handleAddDbEvent = useCallback((date: Date, time?: string) => {
    setSelectedDbEvent(null);
    setSelectedEventDate(date);
    setSelectedEventTime(time);
    setDbEventDialogOpen(true);
  }, []);

  // Handle editing a database event
  const handleEditDbEvent = useCallback((event: ExpandedCalendarEvent) => {
    setSelectedDbEvent(event);
    setSelectedEventDate(undefined);
    setSelectedEventTime(undefined);
    setDbEventDialogOpen(true);
  }, []);

  // Handle saving a database event
  const handleSaveDbEvent = useCallback(async (data: DbEventFormData) => {
    await saveDbEvent(data);
  }, [saveDbEvent]);

  // Handle deleting a database event
  const handleDeleteDbEvent = useCallback(async (id: string) => {
    await deleteDbEvent(id);
  }, [deleteDbEvent]);

  // Collapsed view
  if (!isExpanded) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                <span className="font-medium">Calendar</span>
                {isLoadingEvents && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsExpanded(true)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
            <MiniCalendar 
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              exercises={exercises}
              project={project}
              deliverables={deliverables}
            />
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const isAuthenticated = !!user;

  // Expanded view
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Header */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  Smart Calendar
                  {isLoadingEvents && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Semester {semester} • Week {week}
                  {dbEvents.length > 0 && ` • ${dbEvents.length} events`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View mode tabs */}
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as CalendarViewMode)}>
                <TabsList>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                  <TabsTrigger value="year">Year</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Filter */}
              {courses.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                      {selectedCourses.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {selectedCourses.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Filter by Course</h4>
                      {courses.map(course => (
                        <label key={course.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCourses.includes(course.name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCourses([...selectedCourses, course.name]);
                              } else {
                                setSelectedCourses(selectedCourses.filter(c => c !== course.name));
                              }
                            }}
                            className="rounded border-muted-foreground/30"
                          />
                          {course.name}
                        </label>
                      ))}
                      {selectedCourses.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full mt-2"
                          onClick={() => setSelectedCourses([])}
                        >
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Google Calendar Connect */}
              <Popover open={showGoogleConnect} onOpenChange={setShowGoogleConnect}>
                <PopoverTrigger asChild>
                  <Button 
                    variant={isGoogleConnected ? "default" : "outline"} 
                    size="sm"
                    disabled={isCheckingGoogle}
                  >
                    {isCheckingGoogle ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    {isGoogleConnected ? "Google Connected" : "Connect Google"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0">
                  <GoogleCalendarConnect />
                </PopoverContent>
              </Popover>

              {/* Sync to phone */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Smartphone className="h-4 w-4 mr-2" />
                    Sync
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72">
                  <div className="space-y-3">
                    <h4 className="font-medium">Sync to iPhone Calendar</h4>
                    <p className="text-sm text-muted-foreground">
                      Download the calendar file and open it on your iPhone to add all academic dates and deadlines.
                    </p>
                    <Button onClick={generateICS} className="w-full" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download .ics File
                    </Button>
                    <div className="text-xs text-muted-foreground border-t pt-2">
                      <p className="font-medium mb-1">Instructions:</p>
                      <ol className="list-decimal list-inside space-y-0.5">
                        <li>Download the .ics file</li>
                        <li>Open it on your iPhone</li>
                        <li>Tap "Add All" to sync events</li>
                      </ol>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Add Event */}
              <Button 
                size="sm" 
                onClick={() => handleAddDbEvent(selectedDate)}
                disabled={!isAuthenticated}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>

              {/* Collapse */}
              <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Navigation */}
        <CardContent className="pt-0 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={goToToday}>
                Today
              </Button>
            </div>
            <h3 className="text-lg font-semibold">{getViewTitle()}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSmartPlanner(!showSmartPlanner)}
              className={cn(showSmartPlanner && "text-primary")}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Smart Planner
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Not authenticated warning */}
      {!isAuthenticated && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 text-sm text-amber-700 dark:text-amber-300">
            Sign in to create and save personal events to your calendar.
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className={cn(
        "grid gap-4",
        showSmartPlanner ? "lg:grid-cols-[1fr_300px]" : "grid-cols-1"
      )}>
        {/* Calendar View */}
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            {viewMode === 'week' && (
              <WeekView 
                selectedDate={selectedDate}
                exercises={exercises}
                project={project}
                deliverables={deliverables}
                onDateSelect={setSelectedDate}
                courseFilter={selectedCourses.length > 0 ? selectedCourses : undefined}
                scheduleBlocks={scheduleBlocks}
                onAddEvent={(day, time) => {
                  setSelectedScheduleEvent(null);
                  setSelectedDay(day);
                  setSelectedTime(time);
                  setLegacyDialogOpen(true);
                }}
                onEditEvent={(event) => {
                  setSelectedScheduleEvent(event);
                  setSelectedDay(undefined);
                  setSelectedTime(undefined);
                  setLegacyDialogOpen(true);
                }}
                dbEvents={dbEvents}
                onAddDbEvent={isAuthenticated ? handleAddDbEvent : undefined}
                onEditDbEvent={isAuthenticated ? handleEditDbEvent : undefined}
              />
            )}
            {viewMode === 'month' && (
              <MonthView 
                selectedDate={selectedDate}
                exercises={exercises}
                project={project}
                deliverables={deliverables}
                onDateSelect={setSelectedDate}
              />
            )}
            {viewMode === 'year' && (
              <YearView 
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                onMonthSelect={(date) => {
                  setSelectedDate(date);
                  setViewMode('month');
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Smart Planner Sidebar */}
        {showSmartPlanner && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="shadow-soft sticky top-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {format(selectedDate, 'EEEE, MMM d')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SmartPlanner 
                  selectedDate={selectedDate}
                  exercises={exercises}
                  project={project}
                  deliverables={deliverables}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-soft">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{courses.length}</p>
              <p className="text-xs text-muted-foreground">Courses</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <FlaskConical className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {exercises.filter(e => e.status === 'DONE').length}/{exercises.length}
              </p>
              <p className="text-xs text-muted-foreground">Labs Done</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <CalendarIcon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {dbEvents.length}
              </p>
              <p className="text-xs text-muted-foreground">Events</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {deliverables.filter(d => d.completed).length}/{deliverables.length}
              </p>
              <p className="text-xs text-muted-foreground">Deliverables</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legacy CRUD Dialog (for schedule blocks) */}
      <CalendarEventDialog
        open={legacyDialogOpen}
        onOpenChange={setLegacyDialogOpen}
        event={selectedScheduleEvent}
        selectedDay={selectedDay}
        selectedTime={selectedTime}
        onSave={saveLegacyEvent}
        onDelete={deleteLegacyEvent}
      />

      {/* Enhanced Event Dialog (for database events) */}
      <EnhancedEventDialog
        open={dbEventDialogOpen}
        onOpenChange={setDbEventDialogOpen}
        event={selectedDbEvent}
        selectedDate={selectedEventDate}
        selectedTime={selectedEventTime}
        onSave={handleSaveDbEvent}
        onDelete={handleDeleteDbEvent}
        isLoading={isCreating || isUpdating || isDeleting}
      />
    </motion.div>
  );
}
