// Academic Calendar 2025-2026 - Department Media, Design & IT
// Based on official AP Hogeschool Antwerpen calendar

export interface AcademicEvent {
  id: string;
  title: string;
  titleNL?: string;
  startDate: string; // ISO format YYYY-MM-DD
  endDate?: string;
  type: 'semester_start' | 'holiday' | 'exam_period' | 'bridge_day' | 'results' | 'deadline' | 'special';
  color?: string;
}

export interface WeekInfo {
  weekNumber: number;
  semester: 1 | 2;
  startDate: string;
  endDate: string;
}

export const ACADEMIC_YEAR_2025_2026 = {
  startDate: '2025-09-15',
  endDate: '2026-09-14',
  semesters: {
    semester1: {
      start: '2025-09-15',
      end: '2026-01-30',
      weeks: 12
    },
    semester2: {
      start: '2026-02-02',
      end: '2026-06-19',
      weeks: 13
    }
  }
};

export const ACADEMIC_EVENTS: AcademicEvent[] = [];

// Weekly schedule structure based on the screenshot
export interface ScheduleBlock {
  id: string;
  courseCode: string;
  courseName: string;
  type: 'theory' | 'lab' | 'group' | 'project';
  room?: string;
  lecturer?: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // HH:mm format
  endTime: string;
  groups?: string[];
}

export const SAMPLE_WEEKLY_SCHEDULE: ScheduleBlock[] = [];

// Event types for color coding
export const EVENT_COLORS = {
  theory: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-700 dark:text-blue-300', solid: 'bg-blue-500' },
  lab: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', solid: 'bg-emerald-500' },
  group: { bg: 'bg-teal-500/20', border: 'border-teal-500', text: 'text-teal-700 dark:text-teal-300', solid: 'bg-teal-500' },
  project: { bg: 'bg-violet-500/20', border: 'border-violet-500', text: 'text-violet-700 dark:text-violet-300', solid: 'bg-violet-500' },
  assignment: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-700 dark:text-orange-300', solid: 'bg-orange-500' },
  deadline: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-700 dark:text-red-300', solid: 'bg-red-500' },
  exam: { bg: 'bg-rose-600/20', border: 'border-rose-600', text: 'text-rose-700 dark:text-rose-300', solid: 'bg-rose-600' },
  holiday: { bg: 'bg-muted', border: 'border-muted-foreground/30', text: 'text-muted-foreground', solid: 'bg-muted-foreground/50' },
  study: { bg: 'bg-slate-100 dark:bg-slate-800/50', border: 'border-slate-300 dark:border-slate-600', text: 'text-slate-600 dark:text-slate-400', solid: 'bg-slate-400' },
  results: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-700 dark:text-purple-300', solid: 'bg-purple-500' },
  semester_start: { bg: 'bg-primary/20', border: 'border-primary', text: 'text-primary', solid: 'bg-primary' },
  special: { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-700 dark:text-amber-300', solid: 'bg-amber-500' },
  bridge_day: { bg: 'bg-gray-500/20', border: 'border-gray-500', text: 'text-gray-700 dark:text-gray-300', solid: 'bg-gray-500' },
};

// Get current semester based on date
export function getCurrentSemester(date: Date = new Date()): 1 | 2 {
  const month = date.getMonth() + 1;
  return month >= 9 || month <= 1 ? 1 : 2;
}

// Get week number in semester
export function getSemesterWeek(date: Date = new Date()): { semester: 1 | 2; week: number } {
  const semester = getCurrentSemester(date);
  const semesterStart = new Date(semester === 1 ? ACADEMIC_YEAR_2025_2026.semesters.semester1.start : ACADEMIC_YEAR_2025_2026.semesters.semester2.start);
  const diffTime = date.getTime() - semesterStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return { semester, week: Math.max(1, Math.min(week, semester === 1 ? 12 : 13)) };
}

// Check if date is during exam period
export function isExamPeriod(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return ACADEMIC_EVENTS.some(event => 
    event.type === 'exam_period' && 
    dateStr >= event.startDate && 
    dateStr <= (event.endDate || event.startDate)
  );
}

// Check if date is a holiday
export function isHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return ACADEMIC_EVENTS.some(event => 
    (event.type === 'holiday' || event.type === 'bridge_day') && 
    dateStr >= event.startDate && 
    dateStr <= (event.endDate || event.startDate)
  );
}

// Get events for a specific date
export function getEventsForDate(date: Date): AcademicEvent[] {
  const dateStr = date.toISOString().split('T')[0];
  return ACADEMIC_EVENTS.filter(event => 
    dateStr >= event.startDate && 
    dateStr <= (event.endDate || event.startDate)
  );
}
