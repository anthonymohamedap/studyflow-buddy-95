import { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  CalendarPlus, 
  Download, 
  Smartphone,
  FlaskConical,
  FolderKanban,
  BookOpen,
} from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Exercise = Database['public']['Tables']['exercises']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type Deliverable = Database['public']['Tables']['deliverables']['Row'];

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'exercise' | 'project' | 'deliverable';
  status?: string;
}

interface CourseCalendarProps {
  courseName: string;
  exercises: Exercise[];
  project: Project | null;
  deliverables: Deliverable[];
}

export function CourseCalendar({ courseName, exercises, project, deliverables }: CourseCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Build calendar events from exercises, project, and deliverables
  const events = useMemo(() => {
    const allEvents: CalendarEvent[] = [];

    // Add exercises with deadlines
    exercises.forEach((ex) => {
      if (ex.deadline) {
        allEvents.push({
          id: ex.id,
          title: ex.title,
          date: parseISO(ex.deadline),
          type: 'exercise',
          status: ex.status,
        });
      }
    });

    // Add project deadline
    if (project?.deadline) {
      allEvents.push({
        id: project.id,
        title: project.title,
        date: parseISO(project.deadline),
        type: 'project',
        status: project.status,
      });
    }

    // Add deliverable deadlines
    deliverables.forEach((del) => {
      if (del.deadline) {
        allEvents.push({
          id: del.id,
          title: del.title,
          date: parseISO(del.deadline),
          type: 'deliverable',
          status: del.completed ? 'completed' : 'pending',
        });
      }
    });

    return allEvents;
  }, [exercises, project, deliverables]);

  // Get events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((event) => isSameDay(event.date, selectedDate));
  }, [events, selectedDate]);

  // Get dates that have events for highlighting
  const eventDates = useMemo(() => {
    return events.map((event) => event.date);
  }, [events]);

  // Generate ICS file content
  const generateICS = () => {
    const icsEvents = events.map((event) => {
      const dateStr = format(event.date, "yyyyMMdd'T'HHmmss");
      return `BEGIN:VEVENT
UID:${event.id}@studyplanner
DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}
DTSTART:${dateStr}
DTEND:${dateStr}
SUMMARY:${event.title} (${courseName})
DESCRIPTION:${event.type.charAt(0).toUpperCase() + event.type.slice(1)} deadline for ${courseName}
END:VEVENT`;
    }).join('\n');

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Study Planner//Course Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${courseName} Deadlines
${icsEvents}
END:VCALENDAR`;
  };

  const handleDownloadICS = () => {
    const icsContent = generateICS();
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${courseName.replace(/\s+/g, '_')}_calendar.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Calendar file downloaded! Open it to add to your calendar app.');
  };

  const handleSubscribe = () => {
    // For iPhone, we create a webcal:// link that opens the calendar subscription dialog
    // Since we can't host the file dynamically, we download it
    handleDownloadICS();
    toast.info('On iPhone: Open the downloaded .ics file to add events to your Calendar app.');
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'exercise':
        return <FlaskConical className="h-3 w-3" />;
      case 'project':
        return <FolderKanban className="h-3 w-3" />;
      case 'deliverable':
        return <BookOpen className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'exercise':
        return 'bg-blue-500/20 text-blue-700 dark:text-blue-300';
      case 'project':
        return 'bg-purple-500/20 text-purple-700 dark:text-purple-300';
      case 'deliverable':
        return 'bg-orange-500/20 text-orange-700 dark:text-orange-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            Course Calendar
          </CardTitle>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Smartphone className="h-4 w-4 mr-2" />
                  Sync to Phone
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Add to iPhone Calendar</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Download the calendar file and open it on your iPhone to add all deadlines to your Calendar app.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Button onClick={handleSubscribe} className="w-full" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download .ics File
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground border-t pt-3">
                    <p className="font-medium mb-1">Instructions:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Download the .ics file</li>
                      <li>Open it on your iPhone</li>
                      <li>Tap "Add All" to add to Calendar</li>
                    </ol>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Calendar */}
          <div className="flex-shrink-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border pointer-events-auto"
              modifiers={{
                hasEvent: eventDates,
              }}
              modifiersStyles={{
                hasEvent: {
                  fontWeight: 'bold',
                  textDecoration: 'underline',
                  textDecorationColor: 'hsl(var(--primary))',
                },
              }}
            />
          </div>

          {/* Events for selected date */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium mb-3">
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Select a date'}
            </h4>
            {selectedDateEvents.length > 0 ? (
              <div className="space-y-2">
                {selectedDateEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`p-3 rounded-lg ${getEventColor(event.type)}`}
                  >
                    <div className="flex items-center gap-2">
                      {getEventIcon(event.type)}
                      <span className="font-medium text-sm">{event.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {event.type}
                      </Badge>
                      {event.status && (
                        <Badge variant="secondary" className="text-xs capitalize">
                          {event.status.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No deadlines on this date
              </p>
            )}

            {/* Upcoming deadlines */}
            {events.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">All Deadlines ({events.length})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {events
                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                    .map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedDate(event.date)}
                      >
                        <div className="flex items-center gap-2">
                          {getEventIcon(event.type)}
                          <span className="truncate">{event.title}</span>
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {format(event.date, 'MMM d')}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
