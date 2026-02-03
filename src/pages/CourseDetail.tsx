import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCourse, useCourses } from '@/hooks/useCourses';
import { useTheoryTopics } from '@/hooks/useTheoryTopics';
import { useExercises } from '@/hooks/useExercises';
import { useProject } from '@/hooks/useProjects';
import { useBulkTranslate } from '@/hooks/useTranslation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  ArrowLeft, 
  BookOpen, 
  FlaskConical, 
  FolderKanban, 
  Calendar,
  Bot,
  ExternalLink,
  Mail,
  Trash2,
  Languages,
  Loader2
} from 'lucide-react';
import { TheoryTab } from '@/components/course/TheoryTab';
import { ExercisesTab } from '@/components/course/ExercisesTab';
import { ProjectTab } from '@/components/course/ProjectTab';
import { PlanningTab } from '@/components/course/PlanningTab';
import { LanguageToggle } from '@/components/LanguageToggle';

const AI_POLICY_BADGES = {
  ALLOWED: { label: 'AI Allowed', className: 'bg-success text-success-foreground' },
  LIMITED: { label: 'AI Limited', className: 'bg-warning text-warning-foreground' },
  FORBIDDEN: { label: 'No AI', className: 'bg-destructive text-destructive-foreground' },
};

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: course, isLoading } = useCourse(id);
  const { deleteCourse } = useCourses();
  const { topics } = useTheoryTopics(id);
  const { exercises } = useExercises(id);
  const { project } = useProject(id);
  const bulkTranslate = useBulkTranslate();
  const { language } = useLanguage();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Course not found</h2>
            <p className="text-muted-foreground mb-4">This course doesn't exist or you don't have access to it.</p>
            <Link to="/">
              <Button>Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const aiPolicy = AI_POLICY_BADGES[course.ai_policy as keyof typeof AI_POLICY_BADGES] || AI_POLICY_BADGES.LIMITED;

  const handleDelete = async () => {
    await deleteCourse.mutateAsync(course.id);
    navigate('/');
  };

  // Calculate stats
  const theoryMastered = topics.filter(t => t.status === 'MASTERED').length;
  const exercisesDone = exercises.filter(e => e.status === 'DONE').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{course.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {course.code && <span>{course.code}</span>}
                {course.code && course.lecturer && <span>•</span>}
                {course.lecturer && <span>{course.lecturer}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {language === 'nl' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bulkTranslate.mutate({ type: 'course', id: course.id })}
                  disabled={bulkTranslate.isPending}
                >
                  {bulkTranslate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Languages className="h-4 w-4 mr-2" />
                  )}
                  Translate All
                </Button>
              )}
              <LanguageToggle />
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Course Info Card */}
        <Card className="shadow-soft mb-6">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">{course.credits} ECTS</Badge>
              <Badge className={aiPolicy.className}>
                <Bot className="h-3 w-3 mr-1" />
                {aiPolicy.label}
              </Badge>
              <Badge variant="secondary">
                {course.evaluation_type?.replace('_', ' ')}
              </Badge>
              {course.material_url && (
                <a href={course.material_url} target="_blank" rel="noopener noreferrer">
                  <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Materials
                  </Badge>
                </a>
              )}
              {course.lecturer_email && (
                <a href={`mailto:${course.lecturer_email}`}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                    <Mail className="h-3 w-3 mr-1" />
                    Contact
                  </Badge>
                </a>
              )}
            </div>
            {course.ai_policy_details && (
              <p className="mt-4 text-sm text-muted-foreground border-l-2 border-warning pl-3">
                {course.ai_policy_details}
              </p>
            )}
            
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{topics.length}</p>
                <p className="text-xs text-muted-foreground">Theory Topics</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{theoryMastered}</p>
                <p className="text-xs text-muted-foreground">Mastered</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{exercises.length}</p>
                <p className="text-xs text-muted-foreground">Exercises</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{exercisesDone}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="theory" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="theory" className="gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Theory</span>
            </TabsTrigger>
            <TabsTrigger value="exercises" className="gap-2">
              <FlaskConical className="h-4 w-4" />
              <span className="hidden sm:inline">Labs</span>
            </TabsTrigger>
            <TabsTrigger value="project" className="gap-2">
              <FolderKanban className="h-4 w-4" />
              <span className="hidden sm:inline">Project</span>
            </TabsTrigger>
            <TabsTrigger value="planning" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Planning</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="theory">
            <TheoryTab courseId={course.id} />
          </TabsContent>

          <TabsContent value="exercises">
            <ExercisesTab courseId={course.id} />
          </TabsContent>

          <TabsContent value="project">
            <ProjectTab courseId={course.id} />
          </TabsContent>

          <TabsContent value="planning">
            <PlanningTab courseId={course.id} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{course.name}"? This will also delete all theory topics, exercises, projects, and planning data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
