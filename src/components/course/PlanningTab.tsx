import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useExercises } from '@/hooks/useExercises';
import { useProject, useDeliverables } from '@/hooks/useProjects';
import { useCourse } from '@/hooks/useCourses';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CourseCalendar } from './CourseCalendar';
import { 
  Calendar,
  Clock,
  BookOpen,
  FlaskConical,
  Target,
  ChevronLeft,
  ChevronRight,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type WeekPlan = Database['public']['Tables']['week_plans']['Row'];

interface PlanningTabProps {
  courseId: string;
}

export function PlanningTab({ courseId }: PlanningTabProps) {
  const queryClient = useQueryClient();
  const { data: course } = useCourse(courseId);
  const { exercises } = useExercises(courseId);
  const { project } = useProject(courseId);
  const { deliverables } = useDeliverables(project?.id);
  
  const [currentWeek, setCurrentWeek] = useState(() => {
    // Calculate current academic week (roughly)
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 1, 1); // Feb 1 as semester start
    const weekNumber = Math.ceil((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.min(Math.max(weekNumber, 1), 14);
  });

  const { data: weekPlan, isLoading } = useQuery({
    queryKey: ['week_plan', courseId, currentWeek],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('week_plans')
        .select('*')
        .eq('course_id', courseId)
        .eq('week_number', currentWeek)
        .maybeSingle();
      
      if (error) throw error;
      return data as WeekPlan | null;
    },
  });

  const [formData, setFormData] = useState({
    theory_goals: '',
    exercise_goals: '',
    deliverable_goals: '',
    estimated_hours: 0,
    actual_hours: 0,
  });

  // Update form when week plan loads
  useState(() => {
    if (weekPlan) {
      setFormData({
        theory_goals: weekPlan.theory_goals || '',
        exercise_goals: weekPlan.exercise_goals || '',
        deliverable_goals: weekPlan.deliverable_goals || '',
        estimated_hours: weekPlan.estimated_hours || 0,
        actual_hours: weekPlan.actual_hours || 0,
      });
    } else {
      setFormData({
        theory_goals: '',
        exercise_goals: '',
        deliverable_goals: '',
        estimated_hours: 0,
        actual_hours: 0,
      });
    }
  });

  // Effect to update form when weekPlan changes
  if (weekPlan && formData.theory_goals === '' && formData.exercise_goals === '' && weekPlan.theory_goals) {
    setFormData({
      theory_goals: weekPlan.theory_goals || '',
      exercise_goals: weekPlan.exercise_goals || '',
      deliverable_goals: weekPlan.deliverable_goals || '',
      estimated_hours: weekPlan.estimated_hours || 0,
      actual_hours: weekPlan.actual_hours || 0,
    });
  }

  const savePlan = useMutation({
    mutationFn: async () => {
      if (weekPlan) {
        // Update existing
        const { error } = await supabase
          .from('week_plans')
          .update({
            theory_goals: formData.theory_goals,
            exercise_goals: formData.exercise_goals,
            deliverable_goals: formData.deliverable_goals,
            estimated_hours: formData.estimated_hours,
            actual_hours: formData.actual_hours,
          })
          .eq('id', weekPlan.id);
        
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('week_plans')
          .insert({
            course_id: courseId,
            week_number: currentWeek,
            theory_goals: formData.theory_goals,
            exercise_goals: formData.exercise_goals,
            deliverable_goals: formData.deliverable_goals,
            estimated_hours: formData.estimated_hours,
            actual_hours: formData.actual_hours,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['week_plan', courseId, currentWeek] });
      toast.success('Week plan saved!');
    },
    onError: (error) => {
      toast.error('Failed to save: ' + error.message);
    },
  });

  const timeProgress = formData.estimated_hours > 0 
    ? Math.min((formData.actual_hours / formData.estimated_hours) * 100, 100)
    : 0;

  const handleWeekChange = (delta: number) => {
    const newWeek = currentWeek + delta;
    if (newWeek >= 1 && newWeek <= 14) {
      setCurrentWeek(newWeek);
      // Reset form for new week
      setFormData({
        theory_goals: '',
        exercise_goals: '',
        deliverable_goals: '',
        estimated_hours: 0,
        actual_hours: 0,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <Card className="shadow-soft">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => handleWeekChange(-1)}
              disabled={currentWeek <= 1}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold">Week {currentWeek}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {currentWeek <= 12 ? 'Semester in progress' : 'Exam preparation'}
              </p>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => handleWeekChange(1)}
              disabled={currentWeek >= 14}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Week indicator */}
          <div className="flex gap-1 mt-4 justify-center">
            {Array.from({ length: 14 }, (_, i) => i + 1).map((week) => (
              <button
                key={week}
                onClick={() => {
                  setCurrentWeek(week);
                  setFormData({
                    theory_goals: '',
                    exercise_goals: '',
                    deliverable_goals: '',
                    estimated_hours: 0,
                    actual_hours: 0,
                  });
                }}
                className={`w-6 h-2 rounded-full transition-colors ${
                  week === currentWeek 
                    ? 'bg-primary' 
                    : week < currentWeek 
                      ? 'bg-success/50' 
                      : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Time Tracking */}
      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimated">Estimated Hours</Label>
              <Input
                id="estimated"
                type="number"
                min={0}
                max={40}
                value={formData.estimated_hours}
                onChange={(e) => setFormData({ ...formData, estimated_hours: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual">Actual Hours</Label>
              <Input
                id="actual"
                type="number"
                min={0}
                max={40}
                value={formData.actual_hours}
                onChange={(e) => setFormData({ ...formData, actual_hours: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{formData.actual_hours} / {formData.estimated_hours} hours</span>
            </div>
            <Progress 
              value={timeProgress} 
              className={`h-2 ${timeProgress > 100 ? 'bg-warning/20' : ''}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Goals */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Theory Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.theory_goals}
              onChange={(e) => setFormData({ ...formData, theory_goals: e.target.value })}
              placeholder="What theory to study this week..."
              rows={4}
            />
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-success" />
              Practice Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.exercise_goals}
              onChange={(e) => setFormData({ ...formData, exercise_goals: e.target.value })}
              placeholder="What exercises to complete..."
              rows={4}
            />
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-warning" />
              Deliverables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.deliverable_goals}
              onChange={(e) => setFormData({ ...formData, deliverable_goals: e.target.value })}
              placeholder="What to deliver/submit..."
              rows={4}
            />
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={() => savePlan.mutate()}
          disabled={savePlan.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Save Week Plan
        </Button>
      </div>

      {/* Course Calendar with iPhone Sync */}
      <CourseCalendar
        courseName={course?.name || 'Course'}
        exercises={exercises}
        project={project}
        deliverables={deliverables}
      />
    </div>
  );
}
