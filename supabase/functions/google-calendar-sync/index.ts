import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

// Color mapping for event types
const EVENT_COLORS: Record<string, string> = {
  course: "1", // Lavender
  lab: "2", // Sage
  project: "3", // Grape
  exercise: "5", // Banana
  deadline: "11", // Tomato
  personal: "7", // Peacock
  exam: "4", // Flamingo
};

async function getValidAccessToken(supabase: any, userId: string): Promise<string> {
  const { data: tokenData, error } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !tokenData) {
    throw new Error("Google Calendar not connected");
  }

  // Check if token is expired or will expire soon (within 5 minutes)
  const expiresAt = new Date(tokenData.token_expires_at);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
    // Refresh the token
    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokenData.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const refreshData = await refreshResponse.json();

    if (refreshData.error) {
      throw new Error("Failed to refresh token. Please reconnect Google Calendar.");
    }

    const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);

    await supabase
      .from("google_tokens")
      .update({
        access_token: refreshData.access_token,
        token_expires_at: newExpiresAt.toISOString(),
      })
      .eq("user_id", userId);

    return refreshData.access_token;
  }

  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action, user_id, ...params } = body;

    const accessToken = await getValidAccessToken(supabase, user_id);

    if (action === "list_events") {
      const { time_min, time_max, calendar_id = "primary" } = params;

      const url = new URL(`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendar_id)}/events`);
      url.searchParams.set("timeMin", time_min);
      url.searchParams.set("timeMax", time_max);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "500");

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      // Get local metadata for these events
      const googleEventIds = data.items?.map((e: any) => e.id) || [];
      const { data: localLinks } = await supabase
        .from("calendar_event_links")
        .select("*")
        .eq("user_id", user_id)
        .in("google_event_id", googleEventIds);

      const linksMap = new Map(localLinks?.map((l: any) => [l.google_event_id, l]) || []);

      // Merge Google events with local metadata
      const events = data.items?.map((event: any) => {
        const localData = linksMap.get(event.id);
        return {
          id: event.id,
          title: event.summary || "Untitled",
          description: event.description,
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          all_day: !!event.start?.date,
          color: event.colorId,
          location: event.location,
          // Local metadata
          event_type: localData?.event_type || "personal",
          course_id: localData?.course_id,
          lab_id: localData?.lab_id,
          project_id: localData?.project_id,
          exercise_id: localData?.exercise_id,
          status: localData?.status || "active",
          priority: localData?.priority || "medium",
          metadata: localData?.metadata || {},
        };
      }) || [];

      // Update last synced timestamp
      await supabase
        .from("google_tokens")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("user_id", user_id);

      return new Response(JSON.stringify({ events }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_event") {
      const {
        title,
        description,
        start_date,
        end_date,
        all_day,
        event_type,
        course_id,
        lab_id,
        project_id,
        exercise_id,
        color,
        reminders,
        calendar_id = "primary",
      } = params;

      const eventBody: any = {
        summary: title,
        description,
        colorId: EVENT_COLORS[event_type] || color,
      };

      if (all_day) {
        eventBody.start = { date: start_date.split("T")[0] };
        eventBody.end = { date: end_date.split("T")[0] };
      } else {
        eventBody.start = { dateTime: start_date, timeZone: "UTC" };
        eventBody.end = { dateTime: end_date, timeZone: "UTC" };
      }

      if (reminders) {
        eventBody.reminders = {
          useDefault: false,
          overrides: reminders.map((minutes: number) => ({
            method: "popup",
            minutes,
          })),
        };
      }

      // Add extended properties for local identification
      eventBody.extendedProperties = {
        private: {
          studyflow_type: event_type,
          studyflow_course_id: course_id || "",
        },
      };

      const response = await fetch(
        `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendar_id)}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      // Store local link
      await supabase.from("calendar_event_links").insert({
        user_id,
        google_event_id: data.id,
        event_type,
        course_id,
        lab_id,
        project_id,
        exercise_id,
        title,
        start_date,
        end_date,
        all_day: all_day || false,
        color: EVENT_COLORS[event_type] || color,
      });

      return new Response(JSON.stringify({ event: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_event") {
      const {
        event_id,
        title,
        description,
        start_date,
        end_date,
        all_day,
        event_type,
        status,
        calendar_id = "primary",
      } = params;

      const eventBody: any = {};
      if (title) eventBody.summary = title;
      if (description !== undefined) eventBody.description = description;
      if (event_type) eventBody.colorId = EVENT_COLORS[event_type];

      if (start_date && end_date) {
        if (all_day) {
          eventBody.start = { date: start_date.split("T")[0] };
          eventBody.end = { date: end_date.split("T")[0] };
        } else {
          eventBody.start = { dateTime: start_date, timeZone: "UTC" };
          eventBody.end = { dateTime: end_date, timeZone: "UTC" };
        }
      }

      const response = await fetch(
        `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendar_id)}/events/${event_id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      // Update local link
      const updateData: any = {};
      if (title) updateData.title = title;
      if (start_date) updateData.start_date = start_date;
      if (end_date) updateData.end_date = end_date;
      if (all_day !== undefined) updateData.all_day = all_day;
      if (event_type) updateData.event_type = event_type;
      if (status) updateData.status = status;

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from("calendar_event_links")
          .update(updateData)
          .eq("user_id", user_id)
          .eq("google_event_id", event_id);
      }

      return new Response(JSON.stringify({ event: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_event") {
      const { event_id, calendar_id = "primary" } = params;

      const response = await fetch(
        `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendar_id)}/events/${event_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok && response.status !== 404) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to delete event");
      }

      // Remove local link
      await supabase
        .from("calendar_event_links")
        .delete()
        .eq("user_id", user_id)
        .eq("google_event_id", event_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Google Calendar Sync Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
