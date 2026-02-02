import { useState } from 'react';
import { useExercises } from '@/hooks/useExercises';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Plus, 
  FlaskConical,
  Circle,
  Clock,
  CheckCircle2,
  Trash2,
  ExternalLink,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface ExercisesTabProps {
  courseId: string;
}

const STATUS_CONFIG = {
  NOT_STARTED: { 
    icon: Circle, 
    label: 'Not Started', 
    className: 'text-muted-foreground bg-muted',
    badgeClass: 'bg-muted text-muted-foreground'
  },
  IN_PROGRESS: { 
    icon: Clock, 
    label: 'In Progress', 
    className: 'text-warning bg-warning/10',
    badgeClass: 'bg-warning/20 text-warning'
  },
  DONE: { 
    icon: CheckCircle2, 
    label: 'Done', 
    className: 'text-success bg-success/10',
    badgeClass: 'bg-success/20 text-success'
  },
};

export function ExercisesTab({ courseId }: ExercisesTabProps) {
  const { exercises, isLoading, createExercise, updateExercise, deleteExercise } = useExercises(courseId);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newExercise, setNewExercise] = useState({
    title: '',
    description: '',
    link: '',
    exercise_type: 'LAB' as 'LAB' | 'HOMEWORK' | 'ASSIGNMENT',
    week_number: 1,
    redo_for_exam: false,
  });

  const handleAddExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    await createExercise.mutateAsync({
      course_id: courseId,
      ...newExercise,
    });
    setShowAddDialog(false);
    setNewExercise({
      title: '',
      description: '',
      link: '',
      exercise_type: 'LAB',
      week_number: 1,
      redo_for_exam: false,
    });
  };

  const handleStatusChange = async (exerciseId: string, newStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE') => {
    await updateExercise.mutateAsync({ id: exerciseId, status: newStatus });
  };

  const handleRedoToggle = async (exerciseId: string, redo: boolean) => {
    await updateExercise.mutateAsync({ id: exerciseId, redo_for_exam: redo });
  };

  // Group exercises by week
  const exercisesByWeek = exercises.reduce((acc, ex) => {
    const week = ex.week_number || 0;
    if (!acc[week]) acc[week] = [];
    acc[week].push(ex);
    return acc;
  }, {} as Record<number, typeof exercises>);

  const weeks = Object.keys(exercisesByWeek).map(Number).sort((a, b) => a - b);

  // Count items to redo
  const redoCount = exercises.filter(e => e.redo_for_exam).length;

  if (isLoading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Exercises & Labs</h3>
          <p className="text-sm text-muted-foreground">
            Track your practical work
            {redoCount > 0 && (
              <span className="ml-2 text-warning">
                • {redoCount} to redo for exam
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Exercise
        </Button>
      </div>

      {exercises.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No exercises yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Add lab exercises and homework to track your progress
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Exercise
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {weeks.map((week) => (
            <div key={week}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {week === 0 ? 'Unassigned' : `Week ${week}`}
              </h4>
              <div className="space-y-3">
                {exercisesByWeek[week].map((exercise) => {
                  const status = STATUS_CONFIG[exercise.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.NOT_STARTED;
                  const StatusIcon = status.icon;

                  return (
                    <Card key={exercise.id} className={`shadow-soft hover:shadow-glow transition-shadow ${exercise.redo_for_exam ? 'border-warning/50' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <button
                            onClick={() => {
                              const nextStatus = exercise.status === 'NOT_STARTED' 
                                ? 'IN_PROGRESS' 
                                : exercise.status === 'IN_PROGRESS' 
                                  ? 'DONE' 
                                  : 'NOT_STARTED';
                              handleStatusChange(exercise.id, nextStatus);
                            }}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${status.className}`}
                          >
                            <StatusIcon className="h-5 w-5" />
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-medium flex items-center gap-2">
                                  {exercise.title}
                                  {exercise.redo_for_exam && (
                                    <RefreshCw className="h-4 w-4 text-warning" />
                                  )}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {exercise.exercise_type}
                                  </Badge>
                                  <Badge className={`text-xs ${status.badgeClass}`}>
                                    {status.label}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-8 w-8 ${exercise.redo_for_exam ? 'text-warning' : 'text-muted-foreground'}`}
                                  onClick={() => handleRedoToggle(exercise.id, !exercise.redo_for_exam)}
                                  title={exercise.redo_for_exam ? 'Remove from exam prep' : 'Add to exam prep'}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                {exercise.link && (
                                  <a href={exercise.link} target="_blank" rel="noopener noreferrer">
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </a>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => deleteExercise.mutate(exercise.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {exercise.description && (
                              <p className="text-sm text-muted-foreground mt-2">
                                {exercise.description}
                              </p>
                            )}
                            {exercise.feedback && (
                              <p className="text-sm text-muted-foreground mt-2 border-l-2 border-primary/30 pl-3">
                                💬 {exercise.feedback}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Exercise Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <form onSubmit={handleAddExercise}>
            <DialogHeader>
              <DialogTitle>Add Exercise</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={newExercise.title}
                  onChange={(e) => setNewExercise({ ...newExercise, title: e.target.value })}
                  placeholder="e.g., Lab 1 - Arrays"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="week">Week</Label>
                  <Input
                    id="week"
                    type="number"
                    min={1}
                    max={16}
                    value={newExercise.week_number}
                    onChange={(e) => setNewExercise({ ...newExercise, week_number: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={newExercise.exercise_type}
                    onValueChange={(value: typeof newExercise.exercise_type) => 
                      setNewExercise({ ...newExercise, exercise_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LAB">Lab</SelectItem>
                      <SelectItem value="HOMEWORK">Homework</SelectItem>
                      <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="link">Link</Label>
                <Input
                  id="link"
                  type="url"
                  value={newExercise.link}
                  onChange={(e) => setNewExercise({ ...newExercise, link: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newExercise.description}
                  onChange={(e) => setNewExercise({ ...newExercise, description: e.target.value })}
                  placeholder="What is this exercise about?"
                  rows={2}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="redo"
                  checked={newExercise.redo_for_exam}
                  onCheckedChange={(checked) => 
                    setNewExercise({ ...newExercise, redo_for_exam: checked as boolean })
                  }
                />
                <Label htmlFor="redo" className="text-sm cursor-pointer">
                  Mark for exam preparation (redo later)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createExercise.isPending}>
                Add Exercise
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
