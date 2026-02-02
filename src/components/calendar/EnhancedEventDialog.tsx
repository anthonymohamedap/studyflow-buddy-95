import { useState, useEffect } from 'react';
import { format, addHours, setHours, setMinutes } from 'date-fns';
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
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Save, Calendar as CalendarIcon, MapPin, Repeat, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  CalendarEventFormData, 
  EventType, 
  EventCategory, 
  Recurrence,
  ExpandedCalendarEvent 
} from '@/hooks/useDbCalendarEvents';

interface EnhancedEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: ExpandedCalendarEvent | null;
  selectedDate?: Date;
  selectedTime?: string;
  onSave: (data: CalendarEventFormData) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isLoading?: boolean;
}

const EVENT_TYPES: { value: EventType; label: string; description: string }[] = [
  { value: 'course', label: 'Course', description: 'Lectures, labs, tutorials' },
  { value: 'planner', label: 'Planner', description: 'Assignments, deadlines, exams' },
  { value: 'personal', label: 'Personal', description: 'Personal events, appointments' },
];

const CATEGORIES: Record<EventType, { value: EventCategory; label: string; color: string }[]> = {
  course: [
    { value: 'theory', label: 'Theory / Lecture', color: 'bg-blue-500' },
    { value: 'lab', label: 'Lab / Practical', color: 'bg-emerald-500' },
    { value: 'group', label: 'Group Session', color: 'bg-teal-500' },
    { value: 'project', label: 'Project Work', color: 'bg-violet-500' },
  ],
  planner: [
    { value: 'assignment', label: 'Assignment', color: 'bg-orange-500' },
    { value: 'deadline', label: 'Deadline', color: 'bg-red-500' },
    { value: 'exam', label: 'Exam', color: 'bg-rose-600' },
    { value: 'study', label: 'Study Block', color: 'bg-slate-500' },
  ],
  personal: [
    { value: 'personal', label: 'Personal Event', color: 'bg-cyan-500' },
  ],
};

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minutes = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
});

const COLOR_PRESETS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#14b8a6', // teal
  '#8b5cf6', // violet
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#a855f7', // purple
];

export function EnhancedEventDialog({
  open,
  onOpenChange,
  event,
  selectedDate,
  selectedTime,
  onSave,
  onDelete,
  isLoading,
}: EnhancedEventDialogProps) {
  const isEditing = !!event;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getDefaultEndTime = (startTime: string) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHour = hours + 1;
    return `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const [formData, setFormData] = useState<CalendarEventFormData>({
    title: '',
    description: '',
    event_type: 'personal',
    category: 'personal',
    start_date: selectedDate || new Date(),
    end_date: selectedDate || new Date(),
    all_day: false,
    recurrence: 'none',
    recurrence_end_date: null,
    location: '',
    color: '',
  });

  const [startTime, setStartTime] = useState(selectedTime || '09:00');
  const [endTime, setEndTime] = useState(getDefaultEndTime(selectedTime || '09:00'));

  useEffect(() => {
    if (event) {
      setFormData({
        id: event.originalId,
        title: event.title,
        description: event.description || '',
        event_type: event.event_type,
        category: event.category,
        start_date: event.start_date,
        end_date: event.end_date,
        all_day: event.all_day,
        recurrence: 'none', // We'd need to fetch original event for this
        recurrence_end_date: null,
        location: event.location || '',
        color: event.color || '',
      });
      if (!event.all_day) {
        setStartTime(format(event.start_date, 'HH:mm'));
        setEndTime(format(event.end_date, 'HH:mm'));
      }
    } else {
      const defaultDate = selectedDate || new Date();
      setFormData({
        title: '',
        description: '',
        event_type: 'personal',
        category: 'personal',
        start_date: defaultDate,
        end_date: defaultDate,
        all_day: false,
        recurrence: 'none',
        recurrence_end_date: null,
        location: '',
        color: '',
      });
      setStartTime(selectedTime || '09:00');
      setEndTime(getDefaultEndTime(selectedTime || '09:00'));
    }
    setShowDeleteConfirm(false);
  }, [event, selectedDate, selectedTime, open]);

  // Update category when event type changes
  useEffect(() => {
    const validCategories = CATEGORIES[formData.event_type];
    if (!validCategories.find(c => c.value === formData.category)) {
      setFormData(prev => ({ ...prev, category: validCategories[0].value }));
    }
  }, [formData.event_type, formData.category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let startDate = formData.start_date;
    let endDate = formData.end_date;

    if (!formData.all_day) {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      startDate = setMinutes(setHours(startDate, startHour), startMin);
      endDate = setMinutes(setHours(endDate, endHour), endMin);
    }

    await onSave({
      ...formData,
      start_date: startDate,
      end_date: endDate,
    });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (event && onDelete) {
      await onDelete(event.originalId);
      onOpenChange(false);
    }
  };

  const availableCategories = CATEGORIES[formData.event_type] || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Event' : 'Add New Event'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Modify the event details'
                : 'Create a new event on your calendar'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Team meeting, Ski trip, Assignment deadline"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            {/* Event Type Tabs */}
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Tabs 
                value={formData.event_type} 
                onValueChange={(v) => setFormData({ ...formData, event_type: v as EventType })}
              >
                <TabsList className="grid grid-cols-3 w-full">
                  {EVENT_TYPES.map((type) => (
                    <TabsTrigger key={type.value} value={type.value}>
                      {type.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value: EventCategory) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", cat.color)} />
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* All Day Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="all-day">All-day event</Label>
              <Switch
                id="all-day"
                checked={formData.all_day}
                onCheckedChange={(checked) => setFormData({ ...formData, all_day: checked })}
              />
            </div>

            {/* Date & Time Selection */}
            <div className="grid grid-cols-2 gap-4">
              {/* Start Date */}
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.start_date, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.start_date}
                      onSelect={(date) => date && setFormData({ 
                        ...formData, 
                        start_date: date,
                        end_date: formData.end_date < date ? date : formData.end_date
                      })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.end_date, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.end_date}
                      onSelect={(date) => date && setFormData({ ...formData, end_date: date })}
                      disabled={(date) => date < formData.start_date}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Time Selection (only if not all-day) */}
            {!formData.all_day && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Select value={endTime} onValueChange={setEndTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Recurrence */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Recurrence
              </Label>
              <Select
                value={formData.recurrence}
                onValueChange={(value: Recurrence) => setFormData({ ...formData, recurrence: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recurrence End Date */}
            {formData.recurrence !== 'none' && (
              <div className="space-y-2">
                <Label>Repeat Until</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.recurrence_end_date 
                        ? format(formData.recurrence_end_date, 'PPP')
                        : 'Select end date'
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.recurrence_end_date || undefined}
                      onSelect={(date) => setFormData({ ...formData, recurrence_end_date: date || null })}
                      disabled={(date) => date < formData.start_date}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location
              </Label>
              <Input
                id="location"
                placeholder="e.g., Room ELL.01.08, Online, Alps"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            {/* Custom Color */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Custom Color (optional)
              </Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant={!formData.color ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormData({ ...formData, color: '' })}
                >
                  Auto
                </Button>
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                      formData.color === color ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description / Notes</Label>
              <Textarea
                id="description"
                placeholder="Add any additional details..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {isEditing && onDelete && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2 mr-auto">
                    <span className="text-sm text-muted-foreground">Delete?</span>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={isLoading}
                    >
                      Yes, delete
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="mr-auto"
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? 'Save Changes' : 'Create Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
