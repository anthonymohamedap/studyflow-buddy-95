import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { 
  SAMPLE_WEEKLY_SCHEDULE, 
  ACADEMIC_EVENTS, 
  isHoliday,
  type ScheduleBlock 
} from '@/data/academicCalendar';
import type { CalendarEventFormData } from '@/components/calendar/CalendarEventDialog';

// Generate unique ID
const generateId = () => `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function useCalendarEvents() {
  // Initialize with sample schedule
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>(SAMPLE_WEEKLY_SCHEDULE);

  // Add a new event
  const addEvent = useCallback((data: CalendarEventFormData) => {
    const newEvent: ScheduleBlock = {
      id: generateId(),
      courseCode: data.courseCode,
      courseName: data.courseName,
      type: data.type,
      room: data.room,
      lecturer: data.lecturer,
      dayOfWeek: data.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      startTime: data.startTime,
      endTime: data.endTime,
      groups: data.groups,
    };

    setScheduleBlocks(prev => [...prev, newEvent]);
    toast.success('Event added to schedule');
    return newEvent;
  }, []);

  // Update an existing event
  const updateEvent = useCallback((data: CalendarEventFormData) => {
    if (!data.id) return;

    setScheduleBlocks(prev =>
      prev.map(block =>
        block.id === data.id
          ? {
              ...block,
              courseCode: data.courseCode,
              courseName: data.courseName,
              type: data.type,
              room: data.room,
              lecturer: data.lecturer,
              dayOfWeek: data.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
              startTime: data.startTime,
              endTime: data.endTime,
              groups: data.groups,
            }
          : block
      )
    );
    toast.success('Event updated');
  }, []);

  // Delete an event
  const deleteEvent = useCallback((id: string) => {
    setScheduleBlocks(prev => prev.filter(block => block.id !== id));
    toast.success('Event deleted');
  }, []);

  // Save event (handles both create and update)
  const saveEvent = useCallback((data: CalendarEventFormData) => {
    if (data.id) {
      updateEvent(data);
    } else {
      addEvent(data);
    }
  }, [addEvent, updateEvent]);

  // Get schedule filtered by vacation - returns empty for vacation days
  const getScheduleForDate = useCallback((date: Date): ScheduleBlock[] => {
    // If it's a holiday/vacation, return empty schedule
    if (isHoliday(date)) {
      return [];
    }
    
    const dayOfWeek = date.getDay(); // 0 = Sunday
    return scheduleBlocks.filter(block => block.dayOfWeek === dayOfWeek);
  }, [scheduleBlocks]);

  // Get schedule without vacation filtering (for editing purposes)
  const getAllScheduleBlocks = useCallback((): ScheduleBlock[] => {
    return scheduleBlocks;
  }, [scheduleBlocks]);

  // Check if any schedule exists for a day of week
  const hasScheduleForDay = useCallback((dayOfWeek: number): boolean => {
    return scheduleBlocks.some(block => block.dayOfWeek === dayOfWeek);
  }, [scheduleBlocks]);

  // Get all vacation/holiday periods
  const getVacationPeriods = useMemo(() => {
    return ACADEMIC_EVENTS.filter(
      event => event.type === 'holiday' || event.type === 'bridge_day'
    );
  }, []);

  return {
    scheduleBlocks,
    addEvent,
    updateEvent,
    deleteEvent,
    saveEvent,
    getScheduleForDate,
    getAllScheduleBlocks,
    hasScheduleForDay,
    vacationPeriods: getVacationPeriods,
  };
}
