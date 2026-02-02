import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Save } from 'lucide-react';
import type { ScheduleBlock } from '@/data/academicCalendar';

export interface CalendarEventFormData {
  id?: string;
  courseCode: string;
  courseName: string;
  type: 'theory' | 'lab' | 'group' | 'project';
  room?: string;
  lecturer?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  groups?: string[];
}

interface CalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: ScheduleBlock | null;
  selectedDay?: number;
  selectedTime?: string;
  onSave: (data: CalendarEventFormData) => void;
  onDelete?: (id: string) => void;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const EVENT_TYPES = [
  { value: 'theory', label: 'Theory / Lecture' },
  { value: 'lab', label: 'Lab / Practical' },
  { value: 'group', label: 'Group Session' },
  { value: 'project', label: 'Project Work' },
];

const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minutes = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
});

export function CalendarEventDialog({
  open,
  onOpenChange,
  event,
  selectedDay,
  selectedTime,
  onSave,
  onDelete,
}: CalendarEventDialogProps) {
  const isEditing = !!event;

  const [formData, setFormData] = useState<CalendarEventFormData>({
    courseCode: '',
    courseName: '',
    type: 'theory',
    room: '',
    lecturer: '',
    dayOfWeek: selectedDay ?? 1,
    startTime: selectedTime ?? '09:00',
    endTime: '11:00',
    groups: [],
  });

  useEffect(() => {
    if (event) {
      setFormData({
        id: event.id,
        courseCode: event.courseCode,
        courseName: event.courseName,
        type: event.type,
        room: event.room || '',
        lecturer: event.lecturer || '',
        dayOfWeek: event.dayOfWeek,
        startTime: event.startTime,
        endTime: event.endTime,
        groups: event.groups || [],
      });
    } else {
      setFormData({
        courseCode: '',
        courseName: '',
        type: 'theory',
        room: '',
        lecturer: '',
        dayOfWeek: selectedDay ?? 1,
        startTime: selectedTime ?? '09:00',
        endTime: '11:00',
        groups: [],
      });
    }
  }, [event, selectedDay, selectedTime, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (event && onDelete) {
      onDelete(event.id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Schedule Block' : 'Add Schedule Block'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Modify the course schedule details'
                : 'Add a new course or event to your weekly schedule'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="courseCode">Course Code *</Label>
                <Input
                  id="courseCode"
                  placeholder="e.g., MASV"
                  value={formData.courseCode}
                  onChange={(e) =>
                    setFormData({ ...formData, courseCode: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: CalendarEventFormData['type']) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="courseName">Course Name *</Label>
              <Input
                id="courseName"
                placeholder="e.g., Data Structures"
                value={formData.courseName}
                onChange={(e) =>
                  setFormData({ ...formData, courseName: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dayOfWeek">Day *</Label>
                <Select
                  value={formData.dayOfWeek.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, dayOfWeek: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start *</Label>
                <Select
                  value={formData.startTime}
                  onValueChange={(value) =>
                    setFormData({ ...formData, startTime: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End *</Label>
                <Select
                  value={formData.endTime}
                  onValueChange={(value) =>
                    setFormData({ ...formData, endTime: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="room">Room</Label>
                <Input
                  id="room"
                  placeholder="e.g., ELL.01.08"
                  value={formData.room}
                  onChange={(e) =>
                    setFormData({ ...formData, room: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lecturer">Lecturer</Label>
                <Input
                  id="lecturer"
                  placeholder="e.g., Prof. Smith"
                  value={formData.lecturer}
                  onChange={(e) =>
                    setFormData({ ...formData, lecturer: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {isEditing && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? 'Save Changes' : 'Add Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
