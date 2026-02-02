import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { isHoliday, SAMPLE_WEEKLY_SCHEDULE, type ScheduleBlock } from '@/data/academicCalendar';
import { startOfDay, endOfDay, parseISO, isWithinInterval, addDays, addWeeks, addMonths, isBefore, format } from 'date-fns';

export type EventType = 'course' | 'planner' | 'personal';
export type EventCategory = 'theory' | 'lab' | 'group' | 'project' | 'assignment' | 'deadline' | 'exam' | 'study' | 'personal' | 'holiday';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface CalendarEventDB {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  event_type: EventType;
  category: EventCategory;
  start_date: string;
  end_date: string;
  all_day: boolean;
  recurrence: Recurrence;
  recurrence_end_date?: string | null;
  location?: string | null;
  color?: string | null;
  course_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventFormData {
  id?: string;
  title: string;
  description?: string;
  event_type: EventType;
  category: EventCategory;
  start_date: Date;
  end_date: Date;
  all_day: boolean;
  recurrence: Recurrence;
  recurrence_end_date?: Date | null;
  location?: string;
  color?: string;
  course_id?: string;
}

// Expanded event with recurrence instances
export interface ExpandedCalendarEvent {
  id: string;
  originalId: string;
  title: string;
  description?: string | null;
  event_type: EventType;
  category: EventCategory;
  start_date: Date;
  end_date: Date;
  all_day: boolean;
  location?: string | null;
  color?: string | null;
  course_id?: string | null;
  isRecurrenceInstance: boolean;
  instanceDate?: Date;
}

export function useDbCalendarEvents(startDate?: Date, endDate?: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch events for date range (including events that overlap with the range)
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['calendar-events', user?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true });

      // Filter by date range - fetch events that OVERLAP with the range
      // For recurring events, we also need to fetch events where recurrence_end_date >= range.start
      // An event overlaps if: event.start_date <= range.end AND (event.end_date >= range.start OR recurrence_end_date >= range.start)
      if (startDate && endDate) {
        query = query
          .lte('start_date', endDate.toISOString())
          .or(`end_date.gte.${startDate.toISOString()},recurrence_end_date.gte.${startDate.toISOString()}`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as CalendarEventDB[];
    },
    enabled: !!user?.id,
  });

  // Create event mutation
  const createEvent = useMutation({
    mutationFn: async (data: CalendarEventFormData) => {
      if (!user?.id) throw new Error('User not authenticated');

      const insertData = {
        user_id: user.id,
        title: data.title,
        description: data.description || null,
        event_type: data.event_type,
        category: data.category,
        start_date: data.start_date.toISOString(),
        end_date: data.end_date.toISOString(),
        all_day: data.all_day,
        recurrence: data.recurrence,
        recurrence_end_date: data.recurrence_end_date?.toISOString() || null,
        location: data.location || null,
        color: data.color || null,
        course_id: data.course_id || null,
      };

      const { data: result, error } = await supabase
        .from('calendar_events')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Event created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create event: ${error.message}`);
    },
  });

  // Update event mutation
  const updateEvent = useMutation({
    mutationFn: async (data: CalendarEventFormData) => {
      if (!data.id) throw new Error('Event ID required for update');
      if (!user?.id) throw new Error('User not authenticated');

      const updateData = {
        title: data.title,
        description: data.description || null,
        event_type: data.event_type,
        category: data.category,
        start_date: data.start_date.toISOString(),
        end_date: data.end_date.toISOString(),
        all_day: data.all_day,
        recurrence: data.recurrence,
        recurrence_end_date: data.recurrence_end_date?.toISOString() || null,
        location: data.location || null,
        color: data.color || null,
        course_id: data.course_id || null,
      };

      const { data: result, error } = await supabase
        .from('calendar_events')
        .update(updateData)
        .eq('id', data.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Event updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update event: ${error.message}`);
    },
  });

  // Delete event mutation
  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Event deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete event: ${error.message}`);
    },
  });

  // Save event (create or update)
  const saveEvent = useCallback((data: CalendarEventFormData) => {
    if (data.id) {
      return updateEvent.mutateAsync(data);
    } else {
      return createEvent.mutateAsync(data);
    }
  }, [createEvent, updateEvent]);

  // Expand recurring events into instances
  const expandedEvents = useMemo((): ExpandedCalendarEvent[] => {
    const expanded: ExpandedCalendarEvent[] = [];
    const rangeStart = startDate || new Date();
    const rangeEnd = endDate || addMonths(rangeStart, 1);

    events.forEach(event => {
      const eventStart = parseISO(event.start_date);
      const eventEnd = parseISO(event.end_date);
      const duration = eventEnd.getTime() - eventStart.getTime();

      if (event.recurrence === 'none') {
        // Non-recurring: just check if it overlaps with range
        if (
          isWithinInterval(eventStart, { start: rangeStart, end: rangeEnd }) ||
          isWithinInterval(eventEnd, { start: rangeStart, end: rangeEnd }) ||
          (eventStart <= rangeStart && eventEnd >= rangeEnd)
        ) {
          expanded.push({
            id: event.id,
            originalId: event.id,
            title: event.title,
            description: event.description,
            event_type: event.event_type as EventType,
            category: event.category as EventCategory,
            start_date: eventStart,
            end_date: eventEnd,
            all_day: event.all_day,
            location: event.location,
            color: event.color,
            course_id: event.course_id,
            isRecurrenceInstance: false,
          });
        }
      } else {
        // Recurring: generate instances
        let currentStart = eventStart;
        const recurrenceEnd = event.recurrence_end_date 
          ? parseISO(event.recurrence_end_date) 
          : addMonths(rangeEnd, 1);
        let instanceCount = 0;
        const maxInstances = 365; // Safety limit

        while (isBefore(currentStart, recurrenceEnd) && instanceCount < maxInstances) {
          const currentEnd = new Date(currentStart.getTime() + duration);

          if (
            isWithinInterval(currentStart, { start: rangeStart, end: rangeEnd }) ||
            isWithinInterval(currentEnd, { start: rangeStart, end: rangeEnd })
          ) {
            expanded.push({
              id: `${event.id}-${format(currentStart, 'yyyy-MM-dd')}`,
              originalId: event.id,
              title: event.title,
              description: event.description,
              event_type: event.event_type as EventType,
              category: event.category as EventCategory,
              start_date: currentStart,
              end_date: currentEnd,
              all_day: event.all_day,
              location: event.location,
              color: event.color,
              course_id: event.course_id,
              isRecurrenceInstance: instanceCount > 0,
              instanceDate: currentStart,
            });
          }

          // Move to next occurrence
          switch (event.recurrence) {
            case 'daily':
              currentStart = addDays(currentStart, 1);
              break;
            case 'weekly':
              currentStart = addWeeks(currentStart, 1);
              break;
            case 'monthly':
              currentStart = addMonths(currentStart, 1);
              break;
            default:
              instanceCount = maxInstances; // Exit loop
          }
          instanceCount++;
        }
      }
    });

    return expanded;
  }, [events, startDate, endDate]);

  // Get events for a specific date (including multi-day events)
  const getEventsForDate = useCallback((date: Date): ExpandedCalendarEvent[] => {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    return expandedEvents.filter(event => {
      // Check if event overlaps with this day
      return (
        isWithinInterval(dayStart, { start: event.start_date, end: event.end_date }) ||
        isWithinInterval(event.start_date, { start: dayStart, end: dayEnd })
      );
    });
  }, [expandedEvents]);

  // Check if an event spans multiple days
  const isMultiDayEvent = useCallback((event: ExpandedCalendarEvent): boolean => {
    const startDay = startOfDay(event.start_date);
    const endDay = startOfDay(event.end_date);
    return startDay.getTime() !== endDay.getTime();
  }, []);

  // Get schedule blocks (from sample data, filtered by vacation)
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>(SAMPLE_WEEKLY_SCHEDULE);

  const getScheduleForDate = useCallback((date: Date): ScheduleBlock[] => {
    if (isHoliday(date)) {
      return [];
    }
    const dayOfWeek = date.getDay();
    return scheduleBlocks.filter(block => block.dayOfWeek === dayOfWeek);
  }, [scheduleBlocks]);

  return {
    events,
    expandedEvents,
    isLoading,
    error,
    createEvent: createEvent.mutateAsync,
    updateEvent: updateEvent.mutateAsync,
    deleteEvent: deleteEvent.mutateAsync,
    saveEvent,
    getEventsForDate,
    isMultiDayEvent,
    scheduleBlocks,
    setScheduleBlocks,
    getScheduleForDate,
    isCreating: createEvent.isPending,
    isUpdating: updateEvent.isPending,
    isDeleting: deleteEvent.isPending,
  };
}
