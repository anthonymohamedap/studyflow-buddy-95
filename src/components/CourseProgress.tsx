import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';

interface CourseProgressProps {
  courseId: string;
}

export function CourseProgress({ courseId }: CourseProgressProps) {
  const { data: stats } = useQuery({
    queryKey: ['course-progress', courseId],
    queryFn: async () => {
      const [theoryResult, exercisesResult] = await Promise.all([
        supabase
          .from('theory_topics')
          .select('status')
          .eq('course_id', courseId),
        supabase
          .from('exercises')
          .select('status')
          .eq('course_id', courseId),
      ]);

      const theory = theoryResult.data || [];
      const exercises = exercisesResult.data || [];

      const theoryTotal = theory.length;
      const theoryMastered = theory.filter(t => t.status === 'MASTERED').length;
      const theoryReviewed = theory.filter(t => t.status === 'REVIEWED').length;

      const exercisesTotal = exercises.length;
      const exercisesDone = exercises.filter(e => e.status === 'DONE').length;
      const exercisesInProgress = exercises.filter(e => e.status === 'IN_PROGRESS').length;

      return {
        theoryTotal,
        theoryProgress: theoryTotal > 0 ? ((theoryMastered * 100 + theoryReviewed * 50) / theoryTotal) : 0,
        exercisesTotal,
        exercisesProgress: exercisesTotal > 0 ? (exercisesDone / exercisesTotal * 100) : 0,
      };
    },
  });

  if (!stats) {
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Theory</span>
          <span>--</span>
        </div>
        <Progress value={0} className="h-1.5" />
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Labs</span>
          <span>--</span>
        </div>
        <Progress value={0} className="h-1.5" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Theory</span>
        <span className="font-medium">{Math.round(stats.theoryProgress)}%</span>
      </div>
      <Progress value={stats.theoryProgress} className="h-1.5" />
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Labs</span>
        <span className="font-medium">{Math.round(stats.exercisesProgress)}%</span>
      </div>
      <Progress value={stats.exercisesProgress} className="h-1.5" />
    </div>
  );
}
