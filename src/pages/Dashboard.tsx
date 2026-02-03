import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCourses } from '@/hooks/useCourses';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  GraduationCap, 
  Plus, 
  BookOpen, 
  FlaskConical, 
  FolderKanban,
  Calendar,
  LogOut,
  Bot,
  AlertCircle,
  ChevronRight,
  LayoutDashboard
} from 'lucide-react';
import { AddCourseDialog } from '@/components/AddCourseDialog';
import { CourseProgress } from '@/components/CourseProgress';
import { SmartCalendar } from '@/components/calendar';
import { LanguageToggle } from '@/components/LanguageToggle';

const COURSE_COLORS = [
  'bg-gradient-to-br from-blue-500 to-blue-600',
  'bg-gradient-to-br from-emerald-500 to-emerald-600',
  'bg-gradient-to-br from-violet-500 to-violet-600',
  'bg-gradient-to-br from-rose-500 to-rose-600',
  'bg-gradient-to-br from-amber-500 to-amber-600',
  'bg-gradient-to-br from-cyan-500 to-cyan-600',
];

const AI_POLICY_BADGES = {
  ALLOWED: { label: 'AI Allowed', variant: 'default' as const, className: 'bg-success text-success-foreground' },
  LIMITED: { label: 'AI Limited', variant: 'secondary' as const, className: 'bg-warning text-warning-foreground' },
  FORBIDDEN: { label: 'No AI', variant: 'destructive' as const, className: 'bg-destructive text-destructive-foreground' },
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { courses, isLoading } = useCourses();
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [activeTab, setActiveTab] = useState<'courses' | 'calendar'>('courses');

  // Get all exercises and projects for the calendar
  const allExercises = courses.flatMap(course => {
    // We'll need to fetch these - for now return empty
    return [];
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">StudyFlow</h1>
                <p className="text-xs text-muted-foreground">Welcome back, {user?.email?.split('@')[0]}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'courses' | 'calendar')} className="mb-8">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="courses" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Courses
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendar
            </TabsTrigger>
          </TabsList>

          {/* Courses Tab */}
          <TabsContent value="courses" className="mt-6 space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{courses.length}</p>
                      <p className="text-xs text-muted-foreground">Courses</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <FlaskConical className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">--</p>
                      <p className="text-xs text-muted-foreground">Labs Done</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">--</p>
                      <p className="text-xs text-muted-foreground">Due Soon</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                      <FolderKanban className="h-5 w-5 text-info" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">--</p>
                      <p className="text-xs text-muted-foreground">Projects</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Courses Section */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Your Courses</h2>
                <p className="text-muted-foreground">Manage your OLODs and track progress</p>
              </div>
              <Button onClick={() => setShowAddCourse(true)} className="shadow-soft">
                <Plus className="h-4 w-4 mr-2" />
                Add Course
              </Button>
            </div>

            {isLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="shadow-soft">
                    <CardHeader className="pb-3">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : courses.length === 0 ? (
              <Card className="shadow-soft border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Add your first course to start tracking your studies
                  </p>
                  <Button onClick={() => setShowAddCourse(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Course
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((course, index) => {
                  const aiPolicy = AI_POLICY_BADGES[course.ai_policy as keyof typeof AI_POLICY_BADGES] || AI_POLICY_BADGES.LIMITED;
                  const colorClass = COURSE_COLORS[index % COURSE_COLORS.length];
                  
                  return (
                    <Link to={`/course/${course.id}`} key={course.id}>
                      <Card className="shadow-soft hover:shadow-glow transition-all duration-300 cursor-pointer group overflow-hidden">
                        <div className={`h-2 ${colorClass}`} />
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-1">
                                {course.name}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">
                                {course.lecturer || 'No lecturer assigned'}
                              </p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {course.credits} ECTS
                            </Badge>
                            <Badge className={`text-xs ${aiPolicy.className}`}>
                              <Bot className="h-3 w-3 mr-1" />
                              {aiPolicy.label}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {course.evaluation_type?.replace('_', ' ')}
                            </Badge>
                          </div>
                          
                          <CourseProgress courseId={course.id} />
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="mt-6">
            <SmartCalendar 
              courses={courses}
              defaultExpanded={true}
            />
          </TabsContent>
        </Tabs>
      </main>

      <AddCourseDialog open={showAddCourse} onOpenChange={setShowAddCourse} />
    </div>
  );
}
