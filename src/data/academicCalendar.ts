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

export const ACADEMIC_EVENTS: AcademicEvent[] = [
  // Semester starts
  { id: 'sem1-start', title: 'Semester 1 Start', titleNL: 'Start academiejaar', startDate: '2025-09-15', type: 'semester_start' },
  { id: 'sem2-start', title: 'Semester 2 Start', titleNL: 'Start semester 2', startDate: '2026-02-02', type: 'semester_start' },
  
  // StuDay
  { id: 'studay', title: 'StuDay (PM: No Classes)', titleNL: 'StuDay (nm: lesvrij)', startDate: '2025-09-25', type: 'special' },
  
  // Autumn/Herfstvakantie
  { id: 'autumn-break', title: 'Autumn Break', titleNL: 'Herfstvakantie', startDate: '2025-10-27', endDate: '2025-11-02', type: 'holiday' },
  
  // All Saints / Allerheiligen
  { id: 'all-saints', title: 'All Saints Day', titleNL: 'Allerheiligen', startDate: '2025-11-01', type: 'holiday' },
  { id: 'all-souls', title: 'All Souls Day', titleNL: 'Allerzielen', startDate: '2025-11-02', type: 'holiday' },
  
  // Armistice Day
  { id: 'armistice', title: 'Armistice Day', titleNL: 'Wapenstilstand', startDate: '2025-11-11', type: 'holiday' },
  
  // Christmas Break / Kerstvakantie
  { id: 'christmas', title: 'Christmas', titleNL: 'Kerstmis', startDate: '2025-12-25', type: 'holiday' },
  { id: 'christmas-break', title: 'Christmas Break', titleNL: 'Kerstvakantie', startDate: '2025-12-22', endDate: '2026-01-04', type: 'holiday' },
  
  // New Year
  { id: 'new-year', title: 'New Year', titleNL: 'Nieuwjaar', startDate: '2026-01-01', type: 'holiday' },
  
  // Exam period Semester 1
  { id: 'exam1-period', title: 'Exam Period S1', titleNL: 'Examenperiode S1', startDate: '2026-01-05', endDate: '2026-01-30', type: 'exam_period' },
  
  // Results S1
  { id: 'results-s1', title: 'Exam Results S1', titleNL: 'Bekendmaking examenresultaten', startDate: '2026-01-28', type: 'results' },
  
  // Spring/Krokus Break
  { id: 'spring-break', title: 'Spring Break', titleNL: 'Krokusvakantie', startDate: '2026-02-16', endDate: '2026-02-22', type: 'holiday' },
  
  // Easter Break / Paasvakantie
  { id: 'easter', title: 'Easter', titleNL: 'Pasen', startDate: '2026-04-05', type: 'holiday' },
  { id: 'easter-monday', title: 'Easter Monday', titleNL: 'Paasmaandag', startDate: '2026-04-06', type: 'holiday' },
  { id: 'easter-break', title: 'Easter Break', titleNL: 'Paasvakantie', startDate: '2026-04-06', endDate: '2026-04-19', type: 'holiday' },
  
  // Deadline S2
  { id: 'deadline-s2', title: 'Deadline S2', titleNL: 'Grensdatum S2', startDate: '2026-03-15', type: 'deadline' },
  
  // Labour Day
  { id: 'labour-day', title: 'Labour Day', titleNL: 'Dag van de Arbeid', startDate: '2026-05-01', type: 'holiday' },
  
  // Ascension
  { id: 'ascension', title: 'Ascension Day', titleNL: 'O.L.H.-Hemelvaart', startDate: '2026-05-14', type: 'holiday' },
  { id: 'bridge-ascension', title: 'Bridge Day', titleNL: 'Brugdag', startDate: '2026-05-15', type: 'bridge_day' },
  
  // Pentecost / Pinksteren
  { id: 'pentecost', title: 'Pentecost', titleNL: 'Pinksteren', startDate: '2026-05-24', type: 'holiday' },
  { id: 'pentecost-monday', title: 'Whit Monday', titleNL: 'Pinkstermaandag', startDate: '2026-05-25', type: 'holiday' },
  
  // Exam period Semester 2
  { id: 'exam2-period', title: 'Exam Period S2', titleNL: 'Examenperiode S2', startDate: '2026-06-01', endDate: '2026-06-19', type: 'exam_period' },
  
  // Results S2
  { id: 'results-s2', title: 'Exam Results S2', titleNL: 'Bekendmaking examenresultaten', startDate: '2026-06-23', type: 'results' },
  
  // Summer Break
  { id: 'flemish-day', title: 'Flemish Community Day', titleNL: 'Vlaamse feestdag', startDate: '2026-07-11', type: 'holiday' },
  { id: 'national-day', title: 'National Day', titleNL: 'Nationale feestdag', startDate: '2026-07-21', type: 'holiday' },
  { id: 'summer-break', title: 'Summer Break', titleNL: 'Zomervakantie', startDate: '2026-07-01', endDate: '2026-08-31', type: 'holiday' },
  { id: 'summer-closure', title: 'College Closed', titleNL: 'Zomersluiting', startDate: '2026-07-20', endDate: '2026-08-07', type: 'holiday' },
  
  // Second Exam Period / Tweede examenperiode
  { id: 'exam-resit', title: 'Resit Exams', titleNL: 'Tweede examenperiode', startDate: '2026-08-17', endDate: '2026-09-11', type: 'exam_period' },
  
  // Results Resit
  { id: 'results-resit', title: 'Resit Results', titleNL: 'Bekendmaking examenresultaten', startDate: '2026-09-15', type: 'results' },
];

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

export const SAMPLE_WEEKLY_SCHEDULE: ScheduleBlock[] = [
  // Monday
  {
    id: 'mon-1',
    courseCode: 'MASV',
    courseName: 'Data Structures',
    type: 'theory',
    room: 'ELL.01.08_1',
    dayOfWeek: 1,
    startTime: '09:30',
    endTime: '11:30',
    groups: ['1ITAI1', '1ITBUS_U', '1ITSOF1', '1ITSOF2']
  },
  {
    id: 'mon-2',
    courseCode: 'MASV',
    courseName: 'Data Structures',
    type: 'lab',
    room: 'ELL.01.01',
    dayOfWeek: 1,
    startTime: '11:30',
    endTime: '13:00',
    groups: ['1ITSOF2']
  },
  {
    id: 'mon-3',
    courseCode: 'CHSV',
    courseName: 'UX Design',
    type: 'lab',
    room: 'VIA.02.06_A',
    dayOfWeek: 1,
    startTime: '13:30',
    endTime: '15:30',
    groups: ['2ITBUS1', '2ITSOF2']
  },
  // Tuesday
  {
    id: 'tue-1',
    courseCode: 'NYV',
    courseName: 'ICT Architecture',
    type: 'lab',
    room: 'ELL.03.08',
    dayOfWeek: 2,
    startTime: '09:00',
    endTime: '11:00',
    groups: ['2ITSOF2']
  },
  {
    id: 'tue-2',
    courseCode: 'PET',
    courseName: 'VR Experience',
    type: 'group',
    room: 'ELL.01.06',
    dayOfWeek: 2,
    startTime: '14:00',
    endTime: '16:00',
    groups: ['2ITCSC1', '2ITCSC2']
  },
  {
    id: 'tue-3',
    courseCode: 'SCMAR',
    courseName: 'Business Development',
    type: 'theory',
    room: 'ELL.02.01',
    dayOfWeek: 2,
    startTime: '14:00',
    endTime: '16:00',
    groups: ['1ITVTCSC1', '1ITVTI']
  },
  {
    id: 'tue-4',
    courseCode: 'SCMAR, SERA',
    courseName: 'Business Development',
    type: 'lab',
    room: 'ELL.03.02',
    dayOfWeek: 2,
    startTime: '16:00',
    endTime: '18:00',
    groups: ['1ITVTCSC1', '1ITVTI']
  },
  // Wednesday
  {
    id: 'wed-1',
    courseCode: 'NYV',
    courseName: 'ICT Architecture',
    type: 'theory',
    room: 'ELL.01.08_1',
    dayOfWeek: 3,
    startTime: '11:30',
    endTime: '13:00',
    groups: ['1ITVTAI_EA1', '2ITAI1', '2ITBUS1', '2ITCSC1']
  },
  {
    id: 'wed-2',
    courseCode: 'HERB',
    courseName: 'IT Research',
    type: 'theory',
    room: 'ELL.03.09',
    dayOfWeek: 3,
    startTime: '12:30',
    endTime: '14:00'
  },
  // Thursday
  {
    id: 'thu-1',
    courseCode: 'POS',
    courseName: 'Web Services Java',
    type: 'lab',
    room: 'ELL.03.07',
    dayOfWeek: 4,
    startTime: '15:00',
    endTime: '17:00',
    groups: ['2ITBUS1', '2ITSOF2']
  },
  // Friday
  {
    id: 'fri-1',
    courseCode: 'NYV, VGG',
    courseName: 'Robot Design',
    type: 'lab',
    room: 'ELL.01.22',
    dayOfWeek: 5,
    startTime: '09:00',
    endTime: '14:00',
    groups: ['1ITVTIOT1', '2ITAI1', '2ITBUS1', '2ITCSC1', '2ITCSC2']
  }
];

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
