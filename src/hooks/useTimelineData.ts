import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCourses } from './useCourses';
import { 
  startOfMonth, 
  endOfMonth, 
  addMonths, 
  parseISO, 
  differenceInDays,
  format,
  isSameDay,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval
} from 'date-fns';
import { ACADEMIC_YEAR_2025_2026 } from '@/data/academicCalendar';

export type TimelineZoom = 'semester' | 'month' | 'week';

export interface TimelineEvent {
  id: string;
  title: string;
  type: 'exercise' | 'project' | 'lab' | 'deadline' | 'exam' | 'holiday' | 'lesson';
  startDate: Date;
  endDate?: Date;
  courseId?: string;
  courseName?: string;
  courseColor?: string;
  status?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface OverloadWarning {
  type: 'deadline_cluster' | 'exam_congestion' | 'busy_week';
  date: Date;
  message: string;
  severity: 'low' | 'medium' | 'high';
  eventCount: number;
}

export interface TimelinePeriod {
  start: Date;
  end: Date;
  label: string;
  events: TimelineEvent[];
  overloadWarning?: OverloadWarning;
}

export function useTimelineData(
  zoom: TimelineZoom = 'semester',
  filterCourses: string[] = [],
  filterTypes: string[] = []
) {
  const { user } = useAuth();
  const { courses } = useCourses();

  // Calculate semester bounds
  const semesterBounds = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    
    // Semester 1: Sept - Jan, Semester 2: Feb - June
    if (month >= 8 || month <= 0) {
      // Semester 1
      return {
        start: parseISO(ACADEMIC_YEAR_2025_2026.semesters.semester1.start),
        end: parseISO(ACADEMIC_YEAR_2025_2026.semesters.semester1.end),
        label: 'Semester 1'
      };
    } else {
      // Semester 2
      return {
        start: parseISO(ACADEMIC_YEAR_2025_2026.semesters.semester2.start),
        end: parseISO(ACADEMIC_YEAR_2025_2026.semesters.semester2.end),
        label: 'Semester 2'
      };
    }
  }, []);

  // Fetch all exercises
  const { data: exercises = [] } = useQuery({
    queryKey: ['timeline-exercises', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const courseIds = courses.map(c => c.id);
      if (courseIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .in('course_id', courseIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && courses.length > 0,
  });

  // Fetch all projects
  const { data: projects = [] } = useQuery({
    queryKey: ['timeline-projects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const courseIds = courses.map(c => c.id);
      if (courseIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .in('course_id', courseIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && courses.length > 0,
  });

  // Fetch all labs
  const { data: labs = [] } = useQuery({
    queryKey: ['timeline-labs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const courseIds = courses.map(c => c.id);
      if (courseIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('lab_documents')
        .select('*')
        .in('course_id', courseIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && courses.length > 0,
  });

  // Fetch calendar events
  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['timeline-calendar-events', user?.id, semesterBounds.start, semesterBounds.end],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_date', semesterBounds.start.toISOString())
        .lte('end_date', semesterBounds.end.toISOString());
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Course color mapping
  const courseColorMap = useMemo(() => {
    const colors: Record<string, string> = {};
    courses.forEach((course, index) => {
      const colorClasses = ['blue', 'emerald', 'violet', 'rose', 'amber', 'cyan'];
      colors[course.id] = colorClasses[index % colorClasses.length];
    });
    return colors;
  }, [courses]);

  // Course name mapping
  const courseNameMap = useMemo(() => {
    const names: Record<string, string> = {};
    courses.forEach(course => {
      names[course.id] = course.name;
    });
    return names;
  }, [courses]);

  // Transform all data into timeline events
  const allEvents = useMemo((): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    // Add exercises
    exercises.forEach(ex => {
      if (ex.deadline) {
        events.push({
          id: `exercise-${ex.id}`,
          title: ex.title,
          type: 'exercise',
          startDate: parseISO(ex.deadline),
          courseId: ex.course_id,
          courseName: courseNameMap[ex.course_id],
          courseColor: courseColorMap[ex.course_id],
          status: ex.status,
        });
      }
    });

    // Add projects
    projects.forEach(proj => {
      if (proj.deadline) {
        events.push({
          id: `project-${proj.id}`,
          title: proj.title,
          type: 'project',
          startDate: parseISO(proj.deadline),
          courseId: proj.course_id,
          courseName: courseNameMap[proj.course_id],
          courseColor: courseColorMap[proj.course_id],
          status: proj.status,
        });
      }
    });

    // Add labs
    labs.forEach(lab => {
      if (lab.deadline) {
        events.push({
          id: `lab-${lab.id}`,
          title: lab.title,
          type: 'lab',
          startDate: parseISO(lab.deadline),
          courseId: lab.course_id,
          courseName: courseNameMap[lab.course_id],
          courseColor: courseColorMap[lab.course_id],
          status: lab.status,
        });
      }
    });

    // Add calendar events (exams, deadlines, holidays)
    calendarEvents.forEach(event => {
      let type: TimelineEvent['type'] = 'deadline';
      if (event.category === 'exam') type = 'exam';
      else if (event.category === 'holiday') type = 'holiday';
      else if (event.category === 'theory' || event.category === 'lab') type = 'lesson';

      events.push({
        id: `calendar-${event.id}`,
        title: event.title,
        type,
        startDate: parseISO(event.start_date),
        endDate: parseISO(event.end_date),
        courseId: event.course_id || undefined,
        courseName: event.course_id ? courseNameMap[event.course_id] : undefined,
        courseColor: event.course_id ? courseColorMap[event.course_id] : undefined,
        status: event.status || undefined,
        priority: event.priority as TimelineEvent['priority'] || undefined,
      });
    });

    return events;
  }, [exercises, projects, labs, calendarEvents, courseColorMap, courseNameMap]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    let filtered = allEvents;

    if (filterCourses.length > 0) {
      filtered = filtered.filter(e => 
        !e.courseId || filterCourses.includes(e.courseId)
      );
    }

    if (filterTypes.length > 0) {
      filtered = filtered.filter(e => filterTypes.includes(e.type));
    }

    return filtered;
  }, [allEvents, filterCourses, filterTypes]);

  // Generate timeline periods based on zoom level
  const timelinePeriods = useMemo((): TimelPeriod[] => {
    const periods: TimelinePeriod[] = [];
    const { start, end } = semesterBounds;

    if (zoom === 'semester') {
      // Show months
      const months = eachMonthOfInterval({ start, end });
      months.forEach(monthStart => {
        const monthEnd = endOfMonth(monthStart);
        const monthEvents = filteredEvents.filter(e => 
          e.startDate >= monthStart && e.startDate <= monthEnd
        );
        
        periods.push({
          start: monthStart,
          end: monthEnd,
          label: format(monthStart, 'MMMM'),
          events: monthEvents,
          overloadWarning: detectOverload(monthEvents, monthStart, 'month'),
        });
      });
    } else if (zoom === 'month') {
      // Show weeks for current month
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });
      
      weeks.forEach((weekStart, index) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekEvents = filteredEvents.filter(e => 
          e.startDate >= weekStart && e.startDate <= weekEnd
        );
        
        periods.push({
          start: weekStart,
          end: weekEnd,
          label: `Week ${index + 1}`,
          events: weekEvents,
          overloadWarning: detectOverload(weekEvents, weekStart, 'week'),
        });
      });
    } else {
      // Week zoom: show days
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
      
      days.forEach(day => {
        const dayEvents = filteredEvents.filter(e => isSameDay(e.startDate, day));
        
        periods.push({
          start: day,
          end: day,
          label: format(day, 'EEE d'),
          events: dayEvents,
          overloadWarning: detectOverload(dayEvents, day, 'day'),
        });
      });
    }

    return periods;
  }, [zoom, semesterBounds, filteredEvents]);

  // Detect overload periods (deadline clustering, exam congestion)
  function detectOverload(
    events: TimelineEvent[], 
    date: Date,
    period: 'day' | 'week' | 'month'
  ): OverloadWarning | undefined {
    const deadlines = events.filter(e => 
      e.type === 'exercise' || e.type === 'project' || e.type === 'lab' || e.type === 'deadline'
    );
    const exams = events.filter(e => e.type === 'exam');

    // Thresholds based on period
    const thresholds = {
      day: { deadline: 2, exam: 1 },
      week: { deadline: 5, exam: 2 },
      month: { deadline: 10, exam: 4 },
    };

    const threshold = thresholds[period];

    if (exams.length >= threshold.exam) {
      return {
        type: 'exam_congestion',
        date,
        message: `${exams.length} exams scheduled - consider planning study time`,
        severity: exams.length >= threshold.exam * 1.5 ? 'high' : 'medium',
        eventCount: exams.length,
      };
    }

    if (deadlines.length >= threshold.deadline) {
      return {
        type: 'deadline_cluster',
        date,
        message: `${deadlines.length} deadlines this ${period} - pace yourself`,
        severity: deadlines.length >= threshold.deadline * 1.5 ? 'high' : 'medium',
        eventCount: deadlines.length,
      };
    }

    if (events.length >= (threshold.deadline + threshold.exam)) {
      return {
        type: 'busy_week',
        date,
        message: `Busy ${period} ahead with ${events.length} events`,
        severity: 'low',
        eventCount: events.length,
      };
    }

    return undefined;
  }

  // Get upcoming critical events (next 7 days)
  const upcomingCritical = useMemo(() => {
    const now = new Date();
    const nextWeek = addMonths(now, 0.25); // ~7 days
    
    return filteredEvents
      .filter(e => 
        e.startDate >= now && 
        e.startDate <= nextWeek &&
        (e.type === 'exam' || e.type === 'deadline' || e.type === 'project')
      )
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [filteredEvents]);

  return {
    courses,
    allEvents,
    filteredEvents,
    timelinePeriods,
    semesterBounds,
    upcomingCritical,
    isLoading: !user?.id,
    courseColorMap,
    courseNameMap,
  };
}

interface TimelPeriod extends TimelinePeriod {}
