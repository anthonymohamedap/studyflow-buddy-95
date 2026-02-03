import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface GoogleCalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  all_day: boolean;
  color?: string;
  location?: string;
  event_type: string;
  course_id?: string;
  lab_id?: string;
  project_id?: string;
  exercise_id?: string;
  status: string;
  priority: string;
  metadata: Record<string, any>;
}

interface CreateEventParams {
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  all_day?: boolean;
  event_type: string;
  course_id?: string;
  lab_id?: string;
  project_id?: string;
  exercise_id?: string;
  reminders?: number[];
}

interface UpdateEventParams {
  event_id: string;
  title?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  all_day?: boolean;
  event_type?: string;
  status?: string;
}

export function useGoogleCalendar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if Google Calendar is connected
  const { data: connectionStatus, isLoading: isCheckingConnection } = useQuery({
    queryKey: ['google-calendar-connection', user?.id],
    queryFn: async () => {
      if (!user?.id) return { connected: false };

      const response = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_connection',
          user_id: user.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to check connection');
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Get OAuth URL
  const getAuthUrl = useCallback(async () => {
    if (!user?.id) return null;

    const redirectUri = `${window.location.origin}/calendar-callback`;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_auth_url',
        redirect_uri: redirectUri,
        user_id: user.id,
      }),
    });

    if (!response.ok) throw new Error('Failed to get auth URL');
    const data = await response.json();
    return data.auth_url;
  }, [user?.id]);

  // Connect Google Calendar
  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const authUrl = await getAuthUrl();
      if (authUrl) {
        // Store current URL to redirect back after OAuth
        localStorage.setItem('google_calendar_redirect', window.location.pathname);
        window.location.href = authUrl;
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      toast.error('Failed to connect Google Calendar');
      setIsConnecting(false);
    }
  }, [getAuthUrl]);

  // Exchange code for tokens (called from callback page)
  const exchangeCode = useMutation({
    mutationFn: async (code: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const redirectUri = `${window.location.origin}/calendar-callback`;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'exchange_code',
          code,
          redirect_uri: redirectUri,
          user_id: user.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to exchange code');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-connection'] });
      toast.success('Google Calendar connected!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Disconnect Google Calendar
  const disconnect = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disconnect',
          user_id: user.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to disconnect');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-connection'] });
      queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] });
      toast.success('Google Calendar disconnected');
    },
  });

  // List events
  const useEvents = (timeMin: string, timeMax: string) => {
    return useQuery({
      queryKey: ['google-calendar-events', user?.id, timeMin, timeMax],
      queryFn: async (): Promise<GoogleCalendarEvent[]> => {
        if (!user?.id || !connectionStatus?.connected) return [];

        const response = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'list_events',
            user_id: user.id,
            time_min: timeMin,
            time_max: timeMax,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to fetch events');
        }

        const data = await response.json();
        return data.events;
      },
      enabled: !!user?.id && !!connectionStatus?.connected && !!timeMin && !!timeMax,
      staleTime: 1000 * 60, // 1 minute
    });
  };

  // Create event
  const createEvent = useMutation({
    mutationFn: async (params: CreateEventParams) => {
      if (!user?.id) throw new Error('Not authenticated');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_event',
          user_id: user.id,
          ...params,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create event');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] });
      toast.success('Event created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update event
  const updateEvent = useMutation({
    mutationFn: async (params: UpdateEventParams) => {
      if (!user?.id) throw new Error('Not authenticated');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_event',
          user_id: user.id,
          ...params,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update event');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] });
      toast.success('Event updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete event
  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_event',
          user_id: user.id,
          event_id: eventId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete event');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] });
      toast.success('Event deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    isConnected: connectionStatus?.connected ?? false,
    isCheckingConnection,
    lastSyncedAt: connectionStatus?.last_synced_at,
    isConnecting,
    connect,
    disconnect,
    exchangeCode,
    useEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}
